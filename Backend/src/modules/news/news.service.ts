import { NewsStatus, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { notificationsService } from "../notifications/notifications.service";

type CreateNewsInput = {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  category: string;
};

type UpdateNewsInput = Partial<{
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

    if (news.authorId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para editar esta noticia");
    }

    const data: Record<string, unknown> = { ...input };
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

    if (news.authorId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para eliminar esta noticia");
    }

    await prisma.news.delete({ where: { id: news.id } });
  }
};
