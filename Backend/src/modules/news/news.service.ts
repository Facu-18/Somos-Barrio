import { NewsStatus, UserRole, NewsVoteValue } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { notificationsService } from "../notifications/notifications.service";
import { newsSummaryProvider } from "./ai.provider";

export type CreateNewsInput = {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  category: string;
};

export type UpdateNewsInput = Partial<{
  title: string;
  excerpt: string;
  content: string;
  category: string;
  status: NewsStatus;
}>;

const authorSelect = {
  id: true,
  nickname: true,
  avatarUrl: true,
};

async function resolveBarrio(barrioSlug: string) {
  const barrio = await prisma.barrio.findUnique({ where: { slug: barrioSlug } });
  if (!barrio) throw new ApiError(404, "Barrio no encontrado");
  return barrio;
}

export const newsService = {
  async list(barrioSlug: string, opts: { category?: string; page: number; limit: number }) {
    const barrio = await resolveBarrio(barrioSlug);
    const skip = (opts.page - 1) * opts.limit;

    const where = {
      barrioId: barrio.id,
      status: NewsStatus.PUBLISHED,
      ...(opts.category ? { category: opts.category as any } : {})
    };

    const [items, total] = await Promise.all([
      prisma.news.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          category: true,
          status: true,
          editorObservation: true,
          confirmVotes: true,
          disputeVotes: true,
          unsureVotes: true,
          aiSummary: true,
          publishedAt: true,
          createdAt: true,
          author: { select: authorSelect }
        }
      }),
      prisma.news.count({ where })
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  },

  async getBySlug(barrioSlug: string, newsSlug: string) {
    const barrio = await resolveBarrio(barrioSlug);

    const news = await prisma.news.findFirst({
      where: { barrioId: barrio.id, slug: newsSlug, status: NewsStatus.PUBLISHED },
      include: { author: { select: authorSelect } }
    });

    if (!news) throw new ApiError(404, "Noticia no encontrada");
    return news;
  },

  async create(barrioSlug: string, authorId: string, input: CreateNewsInput) {
    const barrio = await resolveBarrio(barrioSlug);

    const existing = await prisma.news.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ApiError(409, "Ya existe una noticia con ese slug");

    return prisma.news.create({
      data: {
        ...input,
        category: input.category as any,
        authorId,
        barrioId: barrio.id
      },
      include: { author: { select: authorSelect } }
    });
  },

  async update(
    barrioSlug: string,
    newsSlug: string,
    requesterId: string,
    requesterRole: UserRole,
    input: UpdateNewsInput
  ) {
    const barrio = await resolveBarrio(barrioSlug);

    const news = await prisma.news.findFirst({ where: { barrioId: barrio.id, slug: newsSlug } });
    if (!news) throw new ApiError(404, "Noticia no encontrada");

    if (news.authorId !== requesterId && requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.EDITOR) {
      throw new ApiError(403, "No tienes permisos para editar esta noticia");
    }

    if (requesterRole === UserRole.VECINO || requesterRole === UserRole.NEGOCIO) {
      if (input.status && input.status !== NewsStatus.DRAFT && input.status !== NewsStatus.PENDING_REVIEW) {
        throw new ApiError(403, "No tienes permisos para publicar noticias directamente");
      }
    }

    const data: Record<string, unknown> = { ...input };
    if (input.status === NewsStatus.PENDING_REVIEW) {
      data.editorObservation = null;
    }
    if (input.status === NewsStatus.PUBLISHED && !news.publishedAt) {
      data.publishedAt = new Date();
    }

    return prisma.$transaction(async (transaction) => {
      const mayBeFirstPublication = input.status === NewsStatus.PUBLISHED
        && news.status !== NewsStatus.PUBLISHED
        && news.publishedAt === null;
      let firstPublication = false;
      
      if (mayBeFirstPublication) {
        const transition = await transaction.news.updateMany({
          where: { id: news.id, status: { not: NewsStatus.PUBLISHED }, publishedAt: null },
          data
        });
        firstPublication = transition.count === 1;
        if (!firstPublication) {
          delete data.publishedAt;
          await transaction.news.update({ where: { id: news.id }, data });
        }
      } else {
        await transaction.news.update({ where: { id: news.id }, data });
      }

      const updated = await transaction.news.findUniqueOrThrow({
        where: { id: news.id },
        include: { author: { select: authorSelect } }
      });

      if (firstPublication) {
        const recipients = await transaction.user.findMany({
          where: { barrioId: barrio.id, id: { notIn: [requesterId, news.authorId] } },
          select: { id: true }
        });
        await notificationsService.enqueue(transaction, recipients.map(({ id }) => ({
          userId: id,
          title: "Nueva noticia en tu barrio",
          body: updated.title,
          data: {
            type: "news",
            barrioSlug,
            newsSlug: updated.slug,
            url: `/barrios/${barrioSlug}/news/${updated.slug}`
          }
        })));
      }

      return updated;
    });
  },

  async remove(barrioSlug: string, newsSlug: string, requesterId: string, requesterRole: UserRole) {
    const barrio = await resolveBarrio(barrioSlug);

    const news = await prisma.news.findFirst({ where: { barrioId: barrio.id, slug: newsSlug } });
    if (!news) throw new ApiError(404, "Noticia no encontrada");

    if (news.authorId !== requesterId && requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.EDITOR) {
      throw new ApiError(403, "No tienes permisos para eliminar esta noticia");
    }

    await prisma.news.delete({ where: { id: news.id } });
  },

  async listPending(barrioSlug: string, opts?: { page: number; limit: number }) {
    const barrio = await resolveBarrio(barrioSlug);
    
    if (!opts) {
      return prisma.news.findMany({
        where: { barrioId: barrio.id, status: NewsStatus.PENDING_REVIEW },
        orderBy: { createdAt: "asc" },
        include: { author: { select: authorSelect } }
      });
    }

    const skip = (opts.page - 1) * opts.limit;
    const where = {
      barrioId: barrio.id,
      status: NewsStatus.PENDING_REVIEW
    };

    const [items, total] = await Promise.all([
      prisma.news.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        include: { author: { select: authorSelect } }
      }),
      prisma.news.count({ where })
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  },

  async approve(barrioSlug: string, newsSlug: string, aiSummary?: any) {
    const barrio = await resolveBarrio(barrioSlug);

    const news = await prisma.news.findFirst({
      where: { barrioId: barrio.id, slug: newsSlug, status: NewsStatus.PENDING_REVIEW }
    });
    
    if (!news) throw new ApiError(404, "Noticia no encontrada o no está en revisión");

    return prisma.$transaction(async (transaction) => {
      const mayBeFirstPublication = news.publishedAt === null;

      const updated = await transaction.news.update({
        where: { id: news.id },
        data: {
          status: NewsStatus.PUBLISHED,
          publishedAt: new Date(),
          editorObservation: null,
          aiSummary: aiSummary ? aiSummary : null
        },
        include: { author: { select: authorSelect } }
      });

      if (mayBeFirstPublication) {
        const recipients = await transaction.user.findMany({
          where: { barrioId: barrio.id, id: { notIn: [news.authorId] } },
          select: { id: true }
        });
        await notificationsService.enqueue(transaction, recipients.map(({ id }) => ({
          userId: id,
          title: "Nueva noticia en tu barrio",
          body: updated.title,
          data: {
            type: "news",
            barrioSlug,
            newsSlug: updated.slug,
            url: `/barrios/${barrioSlug}/news/${updated.slug}`
          }
        })));
      }

      return updated;
    });
  },

  async reject(barrioSlug: string, newsSlug: string, observation: string) {
    const barrio = await resolveBarrio(barrioSlug);

    const news = await prisma.news.findFirst({ where: { barrioId: barrio.id, slug: newsSlug } });
    if (!news) throw new ApiError(404, "Noticia no encontrada");
    
    return prisma.news.update({
      where: { id: news.id },
      data: {
        status: NewsStatus.DRAFT,
        editorObservation: observation
      },
      include: { author: { select: authorSelect } }
    });
  },

  async vote(
    barrioSlug: string,
    newsSlug: string,
    userId: string,
    input: { value: NewsVoteValue; reason: string; sourceUrl?: string }
  ) {
    const barrio = await resolveBarrio(barrioSlug);

    const news = await prisma.news.findFirst({
      where: { barrioId: barrio.id, slug: newsSlug, status: NewsStatus.PUBLISHED }
    });
    if (!news) throw new ApiError(404, "Noticia no encontrada");

    return prisma.$transaction(async (tx) => {
      const existingVote = await tx.newsVote.findUnique({
        where: { userId_newsId: { userId, newsId: news.id } }
      });

      if (existingVote) {
        if (existingVote.value === input.value && existingVote.reason === input.reason && existingVote.sourceUrl === input.sourceUrl) {
          return existingVote;
        }
        
        const decrementField = existingVote.value === NewsVoteValue.CONFIRM ? 'confirmVotes' :
                               existingVote.value === NewsVoteValue.DISPUTE ? 'disputeVotes' : 'unsureVotes';
        const incrementField = input.value === NewsVoteValue.CONFIRM ? 'confirmVotes' :
                               input.value === NewsVoteValue.DISPUTE ? 'disputeVotes' : 'unsureVotes';
        
        if (decrementField !== incrementField) {
          await tx.news.update({
            where: { id: news.id },
            data: {
              [decrementField]: { decrement: 1 },
              [incrementField]: { increment: 1 }
            }
          });
        }

        return tx.newsVote.update({
          where: { id: existingVote.id },
          data: {
            value: input.value,
            reason: input.reason,
            sourceUrl: input.sourceUrl
          }
        });
      }

      const incrementField = input.value === NewsVoteValue.CONFIRM ? 'confirmVotes' :
                             input.value === NewsVoteValue.DISPUTE ? 'disputeVotes' : 'unsureVotes';

      await tx.news.update({
        where: { id: news.id },
        data: {
          [incrementField]: { increment: 1 }
        }
      });

      return tx.newsVote.create({
        data: {
          userId,
          newsId: news.id,
          value: input.value,
          reason: input.reason,
          sourceUrl: input.sourceUrl
        }
      });
    });
  },

  async getVotes(barrioSlug: string, newsSlug: string, opts: { page?: number; limit?: number }) {
    const barrio = await resolveBarrio(barrioSlug);

    const news = await prisma.news.findFirst({
      where: { barrioId: barrio.id, slug: newsSlug, status: NewsStatus.PUBLISHED }
    });
    if (!news) throw new ApiError(404, "Noticia no encontrada");

    const page = Number(opts.page) || 1;
    const limit = Number(opts.limit) || 10;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.newsVote.findMany({
        where: { newsId: news.id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: authorSelect } }
      }),
      prisma.newsVote.count({ where: { newsId: news.id } })
    ]);

    return { items, total, page, limit };
  },

  async summarize(barrioSlug: string, newsSlug: string) {
    const barrio = await resolveBarrio(barrioSlug);
    const news = await prisma.news.findFirst({
      where: { barrioId: barrio.id, slug: newsSlug }
    });
    if (!news) throw new ApiError(404, "Noticia no encontrada");

    return newsSummaryProvider.summarizeNews(news.title, news.content);
  }
};
