import { MarketplaceStatus, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";

type CreatePostInput = {
  title: string;
  description: string;
  price?: number;
  currency: string;
  category: string;
  images: string[];
  location?: string;
};

type UpdatePostInput = Partial<{
  title: string;
  description: string;
  price: number;
  category: string;
  status: MarketplaceStatus;
  images: string[];
  location: string;
}>;

const userSelect = { id: true, name: true, avatarUrl: true };

async function resolveBarrio(barrioSlug: string) {
  const barrio = await prisma.barrio.findUnique({ where: { slug: barrioSlug } });
  if (!barrio) throw new ApiError(404, "Barrio no encontrado");
  return barrio;
}

export const marketplaceService = {
  async list(barrioSlug: string, opts: { category?: string; page: number; limit: number }) {
    const barrio = await resolveBarrio(barrioSlug);
    const skip = (opts.page - 1) * opts.limit;

    const where = {
      barrioId: barrio.id,
      status: MarketplaceStatus.ACTIVE,
      ...(opts.category ? { category: opts.category as any } : {})
    };

    const [items, total] = await Promise.all([
      prisma.marketplacePost.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          currency: true,
          category: true,
          status: true,
          images: true,
          location: true,
          views: true,
          createdAt: true,
          user: { select: userSelect }
        }
      }),
      prisma.marketplacePost.count({ where })
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  },

  async getById(barrioSlug: string, postId: string) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({
      where: { id: postId, barrioId: barrio.id },
      include: { user: { select: userSelect } }
    });

    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    await prisma.marketplacePost.update({
      where: { id: post.id },
      data: { views: { increment: 1 } }
    });

    return post;
  },

  async create(barrioSlug: string, userId: string, input: CreatePostInput) {
    const barrio = await resolveBarrio(barrioSlug);

    return prisma.marketplacePost.create({
      data: {
        ...input,
        category: input.category as any,
        userId,
        barrioId: barrio.id
      },
      include: { user: { select: userSelect } }
    });
  },

  async update(
    barrioSlug: string,
    postId: string,
    requesterId: string,
    requesterRole: UserRole,
    input: UpdatePostInput
  ) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({ where: { id: postId, barrioId: barrio.id } });
    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    if (post.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para editar esta publicacion");
    }

    return prisma.marketplacePost.update({
      where: { id: post.id },
      data: { ...input, category: input.category as any },
      include: { user: { select: userSelect } }
    });
  },

  async remove(barrioSlug: string, postId: string, requesterId: string, requesterRole: UserRole) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({ where: { id: postId, barrioId: barrio.id } });
    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    if (post.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para eliminar esta publicacion");
    }

    await prisma.marketplacePost.delete({ where: { id: post.id } });
  }
};
