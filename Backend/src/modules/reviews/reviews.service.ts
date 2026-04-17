import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";

const userSelect = { id: true, name: true, avatarUrl: true };

async function resolveBusiness(barrioSlug: string, businessSlug: string) {
  const barrio = await prisma.barrio.findUnique({ where: { slug: barrioSlug } });
  if (!barrio) throw new ApiError(404, "Barrio no encontrado");

  const business = await prisma.business.findFirst({
    where: { barrioId: barrio.id, slug: businessSlug }
  });
  if (!business) throw new ApiError(404, "Comercio no encontrado");

  return business;
}

export const reviewsService = {
  async list(barrioSlug: string, businessSlug: string) {
    const business = await resolveBusiness(barrioSlug, businessSlug);

    const [items, total, aggregate] = await Promise.all([
      prisma.review.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: "desc" },
        include: { user: { select: userSelect } }
      }),
      prisma.review.count({ where: { businessId: business.id } }),
      prisma.review.aggregate({
        where: { businessId: business.id },
        _avg: { rating: true }
      })
    ]);

    return {
      items,
      total,
      averageRating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : null
    };
  },

  async create(barrioSlug: string, businessSlug: string, userId: string, input: { rating: number; comment?: string }) {
    const business = await resolveBusiness(barrioSlug, businessSlug);

    const existing = await prisma.review.findUnique({
      where: { userId_businessId: { userId, businessId: business.id } }
    });

    if (existing) throw new ApiError(409, "Ya dejaste una resena para este comercio");

    return prisma.review.create({
      data: { ...input, userId, businessId: business.id },
      include: { user: { select: userSelect } }
    });
  }
};
