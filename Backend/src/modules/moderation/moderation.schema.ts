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
  queue: z.enum(["PENDING_REVIEW", "REPORTED", "REJECTED", "REMOVED", "APPEALED", "DELETED", "APPROVED"]).optional(),
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

export const forumReasonCodeSchema = z.enum([
  "POLICY_COMPLIANT",
  "THREAT",
  "HARASSMENT",
  "DISCRIMINATION",
  "INAPPROPRIATE_CONTENT",
  "SPAM",
  "REPORT_REVIEW",
  "OTHER_POLICY"
]);

export const moderateForumDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "BLOCK", "REMOVE", "RESTORE"]),
  reasonCode: forumReasonCodeSchema,
  privateNote: z.string().trim().max(2000).optional(),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid()
}).strict();

export const getForumQueueQuerySchema = z.object({
  target: z.enum(["THREAD", "REPLY"]).default("THREAD"),
  queue: z.enum(["PENDING_REVIEW", "REPORTED", "APPEALED", "BLOCKED", "REMOVED"]).default("PENDING_REVIEW"),
  barrioSlug: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20)
}).strict();

export const getForumMetricsQuerySchema = z.object({
  barrioSlug: z.string().optional()
}).strict();

export const metricsOverviewQuerySchema = z.object({
  barrioSlug: z.string().optional(),
  days: z.coerce.number().int().min(1).max(90).default(7)
}).strict();

export type ModerateForumDecisionInput = z.infer<typeof moderateForumDecisionSchema>;
export type ForumQueueQuery = z.infer<typeof getForumQueueQuerySchema>;
export type ModerateMarketplaceDecisionInput = z.infer<typeof moderateMarketplaceDecisionSchema>;
export type ModerateMarketplaceAssetDecisionInput = z.infer<typeof moderateMarketplaceAssetDecisionSchema>;
