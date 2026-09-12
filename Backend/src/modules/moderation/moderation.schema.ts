import { z } from "zod";
import { ModerationStatus } from "@prisma/client";

export const moderateMarketplaceDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REMOVE", "RESTORE"]),
  reason: z.string().min(1, "El motivo es obligatorio"),
  privateNote: z.string().optional()
});

export const getMarketplaceQueueQuerySchema = z.object({
  status: z.nativeEnum(ModerationStatus).optional(),
  barrioSlug: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("20")
});

export type ModerateMarketplaceDecisionInput = z.infer<typeof moderateMarketplaceDecisionSchema>;
