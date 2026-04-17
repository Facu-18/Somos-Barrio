import { z } from "zod";
import { EventRsvpStatus } from "@prisma/client";

export const eventIdParamSchema = z.object({
  barrioSlug: z.string().min(1),
  eventId: z.string().cuid()
});

export const eventsListQuerySchema = z.object({
  upcoming: z.coerce.boolean().default(true),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10)
});

export const createEventSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(2000).optional(),
  date: z.coerce.date(),
  location: z.string().min(2).max(255)
});

export const updateEventSchema = createEventSchema.partial();

export const rsvpSchema = z.object({
  status: z.nativeEnum(EventRsvpStatus)
});
