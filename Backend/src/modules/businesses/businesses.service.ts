import { UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";

type CreateBusinessInput = {
  name: string;
  slug: string;
  category: string;
  address: string;
  description?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  coverImage?: string;
  photos: string[];
  latitude?: number;
  longitude?: number;
};

type UpdateBusinessInput = Partial<Omit<CreateBusinessInput, "slug">>;

const ownerSelect = { id: true, name: true, avatarUrl: true };

async function resolveBarrio(barrioSlug: string) {
  const barrio = await prisma.barrio.findUnique({ where: { slug: barrioSlug } });
  if (!barrio) throw new ApiError(404, "Barrio no encontrado");
  return barrio;
}

export const businessesService = {
  async list(barrioSlug: string, opts: { category?: string; page: number; limit: number }) {
    const barrio = await resolveBarrio(barrioSlug);
    const skip = (opts.page - 1) * opts.limit;

    const where = {
      barrioId: barrio.id,
      ...(opts.category ? { category: opts.category as any } : {})
    };

    const [items, total] = await Promise.all([
      prisma.business.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          address: true,
          phone: true,
          whatsapp: true,
          coverImage: true,
          verified: true,
          createdAt: true,
          owner: { select: ownerSelect }
        }
      }),
      prisma.business.count({ where })
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  },

  async getBySlug(barrioSlug: string, businessSlug: string) {
    const barrio = await resolveBarrio(barrioSlug);

    const business = await prisma.business.findFirst({
      where: { barrioId: barrio.id, slug: businessSlug },
      include: {
        owner: { select: ownerSelect },
        reviews: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } }
        }
      }
    });

    if (!business) throw new ApiError(404, "Comercio no encontrado");
    return business;
  },

  async create(barrioSlug: string, ownerId: string, input: CreateBusinessInput) {
    const barrio = await resolveBarrio(barrioSlug);

    const existing = await prisma.business.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ApiError(409, "Ya existe un comercio con ese slug");

    return prisma.business.create({
      data: {
        ...input,
        category: input.category as any,
        ownerId,
        barrioId: barrio.id
      },
      include: { owner: { select: ownerSelect } }
    });
  },

  async update(
    barrioSlug: string,
    businessSlug: string,
    requesterId: string,
    requesterRole: UserRole,
    input: UpdateBusinessInput
  ) {
    const barrio = await resolveBarrio(barrioSlug);

    const business = await prisma.business.findFirst({ where: { barrioId: barrio.id, slug: businessSlug } });
    if (!business) throw new ApiError(404, "Comercio no encontrado");

    if (business.ownerId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para editar este comercio");
    }

    return prisma.business.update({
      where: { id: business.id },
      data: { ...input, category: input.category as any },
      include: { owner: { select: ownerSelect } }
    });
  },

  async remove(barrioSlug: string, businessSlug: string, requesterId: string, requesterRole: UserRole) {
    const barrio = await resolveBarrio(barrioSlug);

    const business = await prisma.business.findFirst({ where: { barrioId: barrio.id, slug: businessSlug } });
    if (!business) throw new ApiError(404, "Comercio no encontrado");

    if (business.ownerId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para eliminar este comercio");
    }

    await prisma.business.delete({ where: { id: business.id } });
  }
};
