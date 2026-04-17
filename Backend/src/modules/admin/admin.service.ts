import { NewsStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";

type CreateBarrioInput = {
  name: string;
  slug: string;
  city: string;
  province: string;
  country: string;
};

type UpdateBarrioInput = Partial<Omit<CreateBarrioInput, "slug">>;

export const adminService = {
  // ── Barrios ────────────────────────────────────────────────────────────────

  async createBarrio(input: CreateBarrioInput) {
    const existing = await prisma.barrio.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ApiError(409, "Ya existe un barrio con ese slug");

    return prisma.barrio.create({ data: input });
  },

  async updateBarrio(slug: string, input: UpdateBarrioInput) {
    const barrio = await prisma.barrio.findUnique({ where: { slug } });
    if (!barrio) throw new ApiError(404, "Barrio no encontrado");

    return prisma.barrio.update({ where: { slug }, data: input });
  },

  async deleteBarrio(slug: string) {
    const barrio = await prisma.barrio.findUnique({ where: { slug } });
    if (!barrio) throw new ApiError(404, "Barrio no encontrado");

    await prisma.barrio.delete({ where: { slug } });
  },

  // ── Negocios ───────────────────────────────────────────────────────────────

  async verifyBusiness(businessId: string, verified: boolean) {
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new ApiError(404, "Comercio no encontrado");

    return prisma.business.update({
      where: { id: businessId },
      data: { verified },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        barrio: { select: { id: true, name: true, slug: true } }
      }
    });
  },

  // ── Noticias / moderación ──────────────────────────────────────────────────

  async listNews(opts: { status?: NewsStatus; barrioSlug?: string; page: number; limit: number }) {
    const skip = (opts.page - 1) * opts.limit;

    let barrioId: string | undefined;
    if (opts.barrioSlug) {
      const barrio = await prisma.barrio.findUnique({ where: { slug: opts.barrioSlug } });
      if (!barrio) throw new ApiError(404, "Barrio no encontrado");
      barrioId = barrio.id;
    }

    const where = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(barrioId ? { barrioId } : {})
    };

    const [items, total] = await Promise.all([
      prisma.news.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, email: true } },
          barrio: { select: { id: true, name: true, slug: true } }
        }
      }),
      prisma.news.count({ where })
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  },

  // ── Stats generales ────────────────────────────────────────────────────────

  async stats() {
    const [users, barrios, news, businesses, marketplacePosts, events] = await Promise.all([
      prisma.user.count(),
      prisma.barrio.count(),
      prisma.news.count(),
      prisma.business.count(),
      prisma.marketplacePost.count(),
      prisma.event.count()
    ]);

    return { users, barrios, news, businesses, marketplacePosts, events };
  }
};
