import { z } from "zod";
import { MarketplaceAssetStatus } from "@prisma/client";

export const marketplaceReasonCodeSchema = z.enum([
  "POLICY_COMPLIANT",
  "PROHIBITED_ITEM",
  "REGULATED_ITEM",
  "FRAUD_OR_MISLEADING",
  "SPAM_OR_DUPLICATE",
  "INAPPROPRIATE_CONTENT",
  "IMAGE_POLICY",
  "REPORT_REVIEW",
  "CONTENT_CORRECTED",
  "OTHER_POLICY"
]);

export const moderateMarketplaceDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REMOVE", "RESTORE"]),
  reasonCode: marketplaceReasonCodeSchema,
  privateNote: z.string().trim().max(2000).optional(),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid()
}).strict();

export const getMarketplaceQueueQuerySchema = z.object({
  queue: z.enum(["PENDING_REVIEW", "REPORTED", "REJECTED", "REMOVED", "APPEALED", "DELETED"]).optional(),
  barrioSlug: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20)
}).strict();

export const moderateMarketplaceAssetDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reasonCode: marketplaceReasonCodeSchema,
  privateNote: z.string().trim().max(2000).optional(),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid()
}).strict();

export const getMarketplaceAssetQueueQuerySchema = z.object({
  status: z.nativeEnum(MarketplaceAssetStatus).default('QUARANTINED'),
  barrioSlug: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20)
}).strict();

export type ModerateMarketplaceDecisionInput = z.infer<typeof moderateMarketplaceDecisionSchema>;
export type ModerateMarketplaceAssetDecisionInput = z.infer<typeof moderateMarketplaceAssetDecisionSchema>;
