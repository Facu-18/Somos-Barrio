import {
  ForumAppealStatus,
  ForumContentStatus,
  ForumModerationAction,
  ForumReportStatus,
  MarketplaceAssetStatus,
  MarketplaceModerationAction,
  ModerationStatus,
  Prisma,
  UserRole
} from "@prisma/client";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { prisma } from "../../lib/prisma";
import { GaugeSample, METRIC_EVENTS, metrics } from "../../lib/metrics";
import { aiLimiter } from "../news/ai.limiter";
import { forumModerationService } from "../moderation/forum-moderation.service";
import { getModerator, resolveQueueBarrio } from "../moderation/moderation.access";

type AutomatedOutcome = "ALLOW" | "REVIEW" | "BLOCK";

export type Alert = {
  code: "AUTOMATED_BLOCK_SPIKE" | "AI_PROVIDER_RATE_LIMITED" | "QUEUE_BACKLOG" | "QUEUE_STALE" | "AI_BUDGET_NEAR_LIMIT";
  severity: "warning" | "critical";
  message: string;
  value: number;
  threshold: number;
};

const HOUR_MS = 60 * 60 * 1000;

const forumOutcome: Record<ForumContentStatus, AutomatedOutcome | null> = {
  PUBLISHED: "ALLOW",
  PENDING_REVIEW: "REVIEW",
  BLOCKED: "BLOCK",
  REMOVED: null
};
const marketplaceOutcome: Record<ModerationStatus, AutomatedOutcome | null> = {
  APPROVED: "ALLOW",
  PENDING_REVIEW: "REVIEW",
  REJECTED: "BLOCK",
  REMOVED: null
};

const emptyOutcomes = (): Record<AutomatedOutcome, number> => ({ ALLOW: 0, REVIEW: 0, BLOCK: 0 });
const toCountMap = <K extends string>(rows: { key: K | null; count: number }[]) =>
  Object.fromEntries(rows.filter((row) => row.key !== null).map((row) => [row.key, row.count])) as Record<K, number>;

async function queueSnapshot(barrioId?: string) {
  const threadBarrio = barrioId ? { barrioId } : {};
  const replyBarrio = barrioId ? { thread: { barrioId } } : {};
  const postBarrio = barrioId ? { post: { barrioId } } : {};

  const [
    forumPendingThreads, forumPendingReplies, forumOpenReports, forumPendingAppeals,
    oldestThread, oldestReply,
    marketplacePending, marketplaceOpenReports, marketplacePendingAppeals, marketplaceQuarantinedAssets, oldestPost
  ] = await Promise.all([
    prisma.forumThread.count({ where: { ...threadBarrio, deletedAt: null, status: ForumContentStatus.PENDING_REVIEW } }),
    prisma.forumReply.count({ where: { ...replyBarrio, status: ForumContentStatus.PENDING_REVIEW, thread: { deletedAt: null, ...(barrioId ? { barrioId } : {}) } } }),
    prisma.forumReport.count({ where: { status: ForumReportStatus.OPEN, OR: [{ thread: threadBarrio }, { reply: replyBarrio }] } }),
    prisma.forumAppeal.count({ where: { status: ForumAppealStatus.PENDING, OR: [{ thread: threadBarrio }, { reply: replyBarrio }] } }),
    prisma.forumThread.findFirst({ where: { ...threadBarrio, deletedAt: null, status: ForumContentStatus.PENDING_REVIEW }, orderBy: { updatedAt: "asc" }, select: { updatedAt: true } }),
    prisma.forumReply.findFirst({ where: { status: ForumContentStatus.PENDING_REVIEW, thread: { deletedAt: null, ...(barrioId ? { barrioId } : {}) } }, orderBy: { updatedAt: "asc" }, select: { updatedAt: true } }),
    prisma.marketplacePost.count({ where: { ...threadBarrio, deletedAt: null, moderationStatus: ModerationStatus.PENDING_REVIEW } }),
    prisma.marketplaceReport.count({ where: { status: "OPEN", ...postBarrio } }),
    prisma.marketplaceAppeal.count({ where: { status: "PENDING", ...postBarrio } }),
    prisma.marketplaceAsset.count({ where: { ...threadBarrio, status: MarketplaceAssetStatus.QUARANTINED, postId: { not: null } } }),
    prisma.marketplacePost.findFirst({ where: { ...threadBarrio, deletedAt: null, moderationStatus: ModerationStatus.PENDING_REVIEW }, orderBy: { updatedAt: "asc" }, select: { updatedAt: true } })
  ]);

  const oldest = [oldestThread?.updatedAt, oldestReply?.updatedAt, oldestPost?.updatedAt]
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const totalPending = forumPendingThreads + forumPendingReplies + forumPendingAppeals + marketplacePending + marketplacePendingAppeals + marketplaceQuarantinedAssets;
  return {
    forum: { pendingThreads: forumPendingThreads, pendingReplies: forumPendingReplies, openReports: forumOpenReports, pendingAppeals: forumPendingAppeals },
    marketplace: { pendingPosts: marketplacePending, openReports: marketplaceOpenReports, pendingAppeals: marketplacePendingAppeals, quarantinedAssets: marketplaceQuarantinedAssets },
    totalPending,
    oldestPendingAt: oldest?.toISOString() ?? null,
    oldestPendingHours: oldest ? Number(((Date.now() - oldest.getTime()) / HOUR_MS).toFixed(2)) : 0
  };
}

async function automatedBlocksLastHour(barrioId?: string) {
  const since = new Date(Date.now() - HOUR_MS);
  const [forum, marketplace] = await Promise.all([
    prisma.forumModerationDecision.count({
      where: { ...(barrioId ? { barrioId } : {}), createdAt: { gte: since }, action: { in: [ForumModerationAction.AUTO_REVIEW, ForumModerationAction.OWNER_EDIT] }, toStatus: ForumContentStatus.BLOCKED }
    }),
    prisma.marketplaceModerationDecision.count({
      where: { ...(barrioId ? { post: { barrioId } } : {}), createdAt: { gte: since }, action: { in: [MarketplaceModerationAction.AUTO_REVIEW, MarketplaceModerationAction.OWNER_RESUBMIT] }, status: ModerationStatus.REJECTED }
    })
  ]);
  return forum + marketplace;
}

async function shadowRuleMatches(since: Date, barrioId?: string) {
  const forumBarrio = barrioId ? Prisma.sql`AND d."barrioId" = ${barrioId}` : Prisma.empty;
  const marketplaceBarrio = barrioId ? Prisma.sql`AND p."barrioId" = ${barrioId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ ruleId: string; domain: string; matches: bigint }[]>`
    SELECT rule_id AS "ruleId", domain, COUNT(*) AS matches FROM (
      SELECT jsonb_array_elements_text(d.evidence->'shadowRuleIds') AS rule_id, 'FORUM' AS domain
      FROM "ForumModerationDecision" d
      WHERE d."createdAt" >= ${since} AND d.evidence ? 'shadowRuleIds' ${forumBarrio}
      UNION ALL
      SELECT jsonb_array_elements_text(d.evidence->'shadowRuleIds') AS rule_id, 'MARKETPLACE' AS domain
      FROM "MarketplaceModerationDecision" d
      JOIN "MarketplacePost" p ON p.id = d."postId"
      WHERE d."createdAt" >= ${since} AND d.evidence ? 'shadowRuleIds' ${marketplaceBarrio}
    ) matches
    GROUP BY rule_id, domain
    ORDER BY matches DESC
  `;
  return rows.map((row) => ({ ruleId: row.ruleId, domain: row.domain, matches: Number(row.matches) }));
}

async function aiSummary(since: Date, barrioId?: string) {
  const where = { createdAt: { gte: since }, ...(barrioId ? { barrioId } : {}) };
  const [totals, byOperation, byPromptVersion, byFinishReason] = await Promise.all([
    prisma.newsAiGeneration.aggregate({
      where,
      _count: { _all: true },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true, estimatedCostUsd: true },
      _avg: { durationMs: true }
    }),
    prisma.newsAiGeneration.groupBy({ by: ["operation", "cached"], where, _count: { _all: true } }),
    prisma.newsAiGeneration.groupBy({ by: ["promptVersion", "model"], where, _count: { _all: true } }),
    prisma.newsAiGeneration.groupBy({ by: ["finishReason"], where, _count: { _all: true } })
  ]);
  const cacheHits = byOperation.filter((row) => row.cached).reduce((total, row) => total + row._count._all, 0);
  return {
    generations: totals._count._all,
    cacheHits,
    cacheHitRate: totals._count._all ? Number((cacheHits / totals._count._all).toFixed(4)) : 0,
    tokens: {
      prompt: totals._sum.promptTokens ?? 0,
      completion: totals._sum.completionTokens ?? 0,
      total: totals._sum.totalTokens ?? 0
    },
    estimatedCostUsd: Number(totals._sum.estimatedCostUsd ?? 0),
    avgProviderDurationMs: totals._avg.durationMs ? Math.round(totals._avg.durationMs) : null,
    byOperation: byOperation.map((row) => ({ operation: row.operation, cached: row.cached, count: row._count._all })),
    byPromptVersion: byPromptVersion.map((row) => ({ promptVersion: row.promptVersion, model: row.model, count: row._count._all })),
    finishReasons: toCountMap(byFinishReason.map((row) => ({ key: row.finishReason, count: row._count._all })))
  };
}

async function safeBudgetStatus() {
  try {
    return await aiLimiter.getBudgetStatus();
  } catch {
    return null;
  }
}

export function evaluateAlerts(input: {
  automatedBlocksLastHour: number;
  providerRateLimitedLast15Min: number;
  totalPending: number;
  oldestPendingHours: number;
  budgetRatio: number | null;
}): Alert[] {
  const alerts: Alert[] = [];
  if (input.automatedBlocksLastHour >= env.ALERT_AUTOMATED_BLOCKS_PER_HOUR) {
    alerts.push({
      code: "AUTOMATED_BLOCK_SPIKE", severity: "warning",
      message: "Pico de contenido bloqueado automáticamente en la última hora: revisar si es un ataque o un falso positivo de una regla.",
      value: input.automatedBlocksLastHour, threshold: env.ALERT_AUTOMATED_BLOCKS_PER_HOUR
    });
  }
  if (input.providerRateLimitedLast15Min >= env.ALERT_AI_PROVIDER_429_PER_15_MIN) {
    alerts.push({
      code: "AI_PROVIDER_RATE_LIMITED", severity: "warning",
      message: "El proveedor de IA está devolviendo 429 en los últimos 15 minutos.",
      value: input.providerRateLimitedLast15Min, threshold: env.ALERT_AI_PROVIDER_429_PER_15_MIN
    });
  }
  if (input.totalPending >= env.ALERT_QUEUE_BACKLOG) {
    alerts.push({
      code: "QUEUE_BACKLOG", severity: input.totalPending >= env.ALERT_QUEUE_BACKLOG * 2 ? "critical" : "warning",
      message: "Hay una cola de moderación acumulada.",
      value: input.totalPending, threshold: env.ALERT_QUEUE_BACKLOG
    });
  }
  if (input.oldestPendingHours >= env.ALERT_QUEUE_OLDEST_HOURS) {
    alerts.push({
      code: "QUEUE_STALE", severity: "warning",
      message: "Hay contenido esperando revisión humana hace más de lo esperado.",
      value: input.oldestPendingHours, threshold: env.ALERT_QUEUE_OLDEST_HOURS
    });
  }
  if (input.budgetRatio !== null && input.budgetRatio >= env.ALERT_AI_BUDGET_RATIO) {
    alerts.push({
      code: "AI_BUDGET_NEAR_LIMIT", severity: input.budgetRatio >= 1 ? "critical" : "warning",
      message: "El presupuesto diario de tokens de IA está cerca del límite.",
      value: input.budgetRatio, threshold: env.ALERT_AI_BUDGET_RATIO
    });
  }
  return alerts;
}

export const metricsService = {
  async overview(userId: string, opts: { barrioSlug?: string; days: number }) {
    const user = await getModerator(userId);
    const barrioId = await resolveQueueBarrio(user, opts.barrioSlug);
    const isAdmin = user.role === UserRole.ADMIN;
    const since = new Date(Date.now() - opts.days * 24 * HOUR_MS);

    const [forumAutomated, forumManual, forumPolicyVersions, marketplaceAutomated, marketplaceManual, marketplacePolicyVersions, queues, blocksLastHour, shadowRules, overrides, ai, budget] = await Promise.all([
      prisma.forumModerationDecision.groupBy({
        by: ["toStatus"],
        where: { ...(barrioId ? { barrioId } : {}), createdAt: { gte: since }, action: { in: [ForumModerationAction.AUTO_REVIEW, ForumModerationAction.OWNER_EDIT] } },
        _count: { _all: true }
      }),
      prisma.forumModerationDecision.groupBy({
        by: ["action"],
        where: { ...(barrioId ? { barrioId } : {}), createdAt: { gte: since }, action: { notIn: [ForumModerationAction.AUTO_REVIEW, ForumModerationAction.OWNER_EDIT, ForumModerationAction.OWNER_DELETE, ForumModerationAction.REPORT_THRESHOLD] } },
        _count: { _all: true }
      }),
      prisma.forumModerationDecision.groupBy({
        by: ["policyVersion"],
        where: { ...(barrioId ? { barrioId } : {}), createdAt: { gte: since } },
        _count: { _all: true }
      }),
      prisma.marketplaceModerationDecision.groupBy({
        by: ["status"],
        where: { ...(barrioId ? { post: { barrioId } } : {}), createdAt: { gte: since }, action: { in: [MarketplaceModerationAction.AUTO_REVIEW, MarketplaceModerationAction.OWNER_RESUBMIT] } },
        _count: { _all: true }
      }),
      prisma.marketplaceModerationDecision.groupBy({
        by: ["action"],
        where: { ...(barrioId ? { post: { barrioId } } : {}), createdAt: { gte: since }, moderatorId: { not: null } },
        _count: { _all: true }
      }),
      prisma.marketplaceModerationDecision.groupBy({
        by: ["policyVersion"],
        where: { ...(barrioId ? { post: { barrioId } } : {}), createdAt: { gte: since } },
        _count: { _all: true }
      }),
      queueSnapshot(barrioId),
      automatedBlocksLastHour(barrioId),
      shadowRuleMatches(since, barrioId),
      forumModerationService.getMetrics(userId, { barrioSlug: opts.barrioSlug }),
      aiSummary(since, barrioId),
      // El presupuesto de IA es global: solo lo ven administradores.
      isAdmin ? safeBudgetStatus() : Promise.resolve(null)
    ]);

    const forumOutcomes = emptyOutcomes();
    for (const row of forumAutomated) {
      const outcome = forumOutcome[row.toStatus];
      if (outcome) forumOutcomes[outcome] += row._count._all;
    }
    const marketplaceOutcomes = emptyOutcomes();
    for (const row of marketplaceAutomated) {
      const outcome = marketplaceOutcome[row.status];
      if (outcome) marketplaceOutcomes[outcome] += row._count._all;
    }

    const alerts = evaluateAlerts({
      automatedBlocksLastHour: blocksLastHour,
      providerRateLimitedLast15Min: metrics.countEvents(METRIC_EVENTS.aiProviderRateLimited, 15 * 60 * 1000),
      totalPending: queues.totalPending,
      oldestPendingHours: queues.oldestPendingHours,
      budgetRatio: budget?.ratio ?? null
    });
    if (alerts.length) {
      logger.warn({ alerts: alerts.map((alert) => ({ code: alert.code, severity: alert.severity, value: alert.value })) }, "Alertas de moderación activas");
    }

    return {
      scope: barrioId ? "BARRIO" : "GLOBAL",
      window: { days: opts.days, since: since.toISOString() },
      moderation: {
        forum: {
          automated: forumOutcomes,
          manual: toCountMap(forumManual.map((row) => ({ key: row.action, count: row._count._all }))),
          policyVersions: toCountMap(forumPolicyVersions.map((row) => ({ key: row.policyVersion, count: row._count._all })))
        },
        marketplace: {
          automated: marketplaceOutcomes,
          manual: toCountMap(marketplaceManual.map((row) => ({ key: row.action, count: row._count._all }))),
          policyVersions: toCountMap(marketplacePolicyVersions.map((row) => ({ key: row.policyVersion, count: row._count._all })))
        },
        automatedBlocksLastHour: blocksLastHour,
        shadowRules,
        forumOverrides: overrides.rules
      },
      queues,
      ai: { ...ai, budget },
      alerts
    };
  },

  /** Gauges calculados en cada scrape: colas y presupuesto (globales). */
  async prometheusGauges(): Promise<GaugeSample[]> {
    const queues = await queueSnapshot();
    const budget = await safeBudgetStatus();
    return [
      { name: "moderation_queue_pending", help: "Contenido esperando revisión humana", value: queues.forum.pendingThreads, labels: { domain: "FORUM", kind: "thread" } },
      { name: "moderation_queue_pending", help: "Contenido esperando revisión humana", value: queues.forum.pendingReplies, labels: { domain: "FORUM", kind: "reply" } },
      { name: "moderation_queue_pending", help: "Contenido esperando revisión humana", value: queues.marketplace.pendingPosts, labels: { domain: "MARKETPLACE", kind: "post" } },
      { name: "moderation_queue_pending", help: "Contenido esperando revisión humana", value: queues.marketplace.quarantinedAssets, labels: { domain: "MARKETPLACE", kind: "asset" } },
      { name: "moderation_open_reports", help: "Reportes abiertos", value: queues.forum.openReports, labels: { domain: "FORUM" } },
      { name: "moderation_open_reports", help: "Reportes abiertos", value: queues.marketplace.openReports, labels: { domain: "MARKETPLACE" } },
      { name: "moderation_pending_appeals", help: "Apelaciones pendientes", value: queues.forum.pendingAppeals, labels: { domain: "FORUM" } },
      { name: "moderation_pending_appeals", help: "Apelaciones pendientes", value: queues.marketplace.pendingAppeals, labels: { domain: "MARKETPLACE" } },
      { name: "moderation_oldest_pending_hours", help: "Antigüedad del contenido pendiente más viejo", value: queues.oldestPendingHours },
      ...(budget
        ? [
          { name: "ai_budget_tokens_spent", help: "Tokens del presupuesto diario reservados o consumidos hoy", value: budget.spent },
          { name: "ai_budget_tokens_limit", help: "Presupuesto diario de tokens (0 = sin límite)", value: budget.limit }
        ]
        : [])
    ];
  }
};
