import { EventRsvpStatus, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";

type CreateEventInput = {
  title: string;
  description?: string;
  date: Date;
  location: string;
};

const userSelect = { id: true, name: true, avatarUrl: true };

async function resolveBarrio(barrioSlug: string) {
  const barrio = await prisma.barrio.findUnique({ where: { slug: barrioSlug } });
  if (!barrio) throw new ApiError(404, "Barrio no encontrado");
  return barrio;
}

export const eventsService = {
  async list(barrioSlug: string, opts: { upcoming: boolean; page: number; limit: number }) {
    const barrio = await resolveBarrio(barrioSlug);
    const skip = (opts.page - 1) * opts.limit;

    const where = {
      barrioId: barrio.id,
      ...(opts.upcoming ? { date: { gte: new Date() } } : {})
    };

    const [items, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { date: "asc" },
        include: {
          user: { select: userSelect },
          _count: { select: { rsvps: true } }
        }
      }),
      prisma.event.count({ where })
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  },

  async getById(barrioSlug: string, eventId: string) {
    const barrio = await resolveBarrio(barrioSlug);

    const event = await prisma.event.findFirst({
      where: { id: eventId, barrioId: barrio.id },
      include: {
        user: { select: userSelect },
        rsvps: {
          include: { user: { select: userSelect } }
        }
      }
    });

    if (!event) throw new ApiError(404, "Evento no encontrado");
    return event;
  },

  async create(barrioSlug: string, userId: string, input: CreateEventInput) {
    const barrio = await resolveBarrio(barrioSlug);

    return prisma.event.create({
      data: { ...input, userId, barrioId: barrio.id },
      include: { user: { select: userSelect } }
    });
  },

  async update(
    barrioSlug: string,
    eventId: string,
    requesterId: string,
    requesterRole: UserRole,
    input: Partial<CreateEventInput>
  ) {
    const barrio = await resolveBarrio(barrioSlug);

    const event = await prisma.event.findFirst({ where: { id: eventId, barrioId: barrio.id } });
    if (!event) throw new ApiError(404, "Evento no encontrado");

    if (event.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para editar este evento");
    }

    return prisma.event.update({
      where: { id: event.id },
      data: input,
      include: { user: { select: userSelect } }
    });
  },

  async remove(barrioSlug: string, eventId: string, requesterId: string, requesterRole: UserRole) {
    const barrio = await resolveBarrio(barrioSlug);

    const event = await prisma.event.findFirst({ where: { id: eventId, barrioId: barrio.id } });
    if (!event) throw new ApiError(404, "Evento no encontrado");

    if (event.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para eliminar este evento");
    }

    await prisma.event.delete({ where: { id: event.id } });
  },

  async rsvp(barrioSlug: string, eventId: string, userId: string, status: EventRsvpStatus) {
    const barrio = await resolveBarrio(barrioSlug);

    const event = await prisma.event.findFirst({ where: { id: eventId, barrioId: barrio.id } });
    if (!event) throw new ApiError(404, "Evento no encontrado");

    return prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId: event.id, userId } },
      update: { status },
      create: { eventId: event.id, userId, status }
    });
  }
};
