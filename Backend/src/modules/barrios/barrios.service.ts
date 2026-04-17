import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";

export const barriosService = {
  async list() {
    return prisma.barrio.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        province: true,
        country: true,
        createdAt: true
      }
    });
  },

  async getBySlug(slug: string) {
    const barrio = await prisma.barrio.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        province: true,
        country: true,
        createdAt: true
      }
    });

    if (!barrio) {
      throw new ApiError(404, "Barrio no encontrado");
    }

    return barrio;
  }
};
