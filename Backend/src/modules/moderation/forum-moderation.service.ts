import {
  ForumAppealStatus,
  ForumContentStatus,
  ForumModerationAction,
  ForumReportStatus,
  Prisma,
  UserRole
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { moderationMetrics } from "../../lib/metrics";
import { ApiError } from "../../utils/api-error";
import {
  ForumTarget,
  HUMAN_HOLD_RULES,
  MANUAL_REVIEW_POLICY_VERSION,
  findOverriddenRule,
  isRetained,
  publishReplyOnce,
  targetKey
} from "../forum/forum.moderation";
import { assertBarrioAccess, getModerator, resolveQueueBarrio, serializable } from "./moderation.access";
import type { ForumQueueQuery, ModerateForumDecisionInput } from "./moderation.schema";

type Decision = ModerateForumDecisionInput["decision"];

const authorSelect = { id: true, name: true, email: true, nickname: true } as const;
const internalOmit = { moderationContentHash: true } as const;

function queueInclude(kind: ForumTarget["kind"]) {
  return {
    user: { select: authorSelect },
    reports: {
      where: { status: ForumReportStatus.OPEN },
      orderBy: { createdAt: "desc" as const },
      select: { id: true, category: true, comment: true, createdAt: true, reporter: { select: { id: true, nickname: true } } }
    },
    appeals: {
      where: { status: ForumAppealStatus.PENDING },
      take: 1,
      select: { id: true, statement: true, contentVersion: true, createdAt: true }
    },
    decisions: {
      orderBy: { toVersion: "desc" as const },
      take: 10,
      select: {
        id: true, action: true, fromStatus: true, toStatus: true, fromVersion: true, toVersion: true,
        reasonCode: true, privateNote: true, ruleId: true, policyVersion: true, createdAt: true,
        actor: { select: { id: true, name: true } }
      }
    },
    ...(kind === "thread"
      ? { barrio: { select: { id: true, name: true, slug: true } }, subforum: { select: { slug: true, name: true } } }
      : {
        thread: {
          select: {
            id: true, title: true, status: true, isClosed: true,
            barrio: { select: { id: true, name: true, slug: true } },
            subforum: { select: { slug: true, name: true } }
          }
        }
      })
  };
}

// Transición según el estado actual. Con una apelación pendiente, aprobar la acepta y bloquear la rechaza.
function transitionFor(
  current: ForumContentStatus,
  decision: Decision,
  context: { hasPendingAppeal: boolean; hasOpenReports: boolean }
): { status: ForumContentStatus; action: ForumModerationAction } {
  const appealable = current === ForumContentStatus.BLOCKED || current === ForumContentStatus.REMOVED;
  if (context.hasPendingAppeal && appealable) {
    if (decision === "APPROVE") return { status: ForumContentStatus.PUBLISHED, action: ForumModerationAction.APPEAL_ACCEPT };
    if (decision === "BLOCK") return { status: current, action: ForumModerationAction.APPEAL_REJECT };
  }

  if (decision === "APPROVE" && isRetained(current)) {
    return { status: ForumContentStatus.PUBLISHED, action: ForumModerationAction.APPROVE };
  }
  if (decision === "APPROVE" && current === ForumContentStatus.PUBLISHED && context.hasOpenReports) {
    return { status: current, action: ForumModerationAction.DISMISS_REPORTS };
  }
  if (decision === "BLOCK" && current === ForumContentStatus.PENDING_REVIEW) {
    return { status: ForumContentStatus.BLOCKED, action: ForumModerationAction.BLOCK };
  }
  if (decision === "REMOVE" && current !== ForumContentStatus.REMOVED) {
    return { status: ForumContentStatus.REMOVED, action: ForumModerationAction.REMOVE };
  }
  if (decision === "RESTORE" && current === ForumContentStatus.REMOVED) {
    return { status: ForumContentStatus.PUBLISHED, action: ForumModerationAction.RESTORE };
  }
  throw new ApiError(409, "INVALID_MODERATION_TRANSITION");
}

const actionsByDecision: Record<Decision, ForumModerationAction[]> = {
  APPROVE: [ForumModerationAction.APPROVE, ForumModerationAction.APPEAL_ACCEPT, ForumModerationAction.DISMISS_REPORTS],
  BLOCK: [ForumModerationAction.BLOCK, ForumModerationAction.APPEAL_REJECT],
  REMOVE: [ForumModerationAction.REMOVE],
  RESTORE: [ForumModerationAction.RESTORE]
};

function sameDecisionRequest(
  existing: { threadId: string | null; replyId: string | null; actorId: string | null; action: ForumModerationAction; reasonCode: string | null; privateNote: string | null; fromVersion: number | null },
  userId: string,
  target: ForumTarget,
  input: ModerateForumDecisionInput
) {
  const sameTarget = target.kind === "thread" ? existing.threadId === target.id : existing.replyId === target.id;
  return sameTarget
    && existing.actorId === userId
    && actionsByDecision[input.decision].includes(existing.action)
    && existing.reasonCode === input.reasonCode
    && existing.privateNote === (input.privateNote ?? null)
    && existing.fromVersion === input.expectedVersion;
}

type LockedContent = {
  id: string;
  userId: string;
  status: ForumContentStatus;
  moderationVersion: number;
  barrioId: string;
  barrioSlug: string;
  subforumSlug: string;
  threadId: string;
  threadAuthorId: string;
  parentReplyId: string | null;
  publishedAt: Date | null;
};

async function lockContent(tx: Prisma.TransactionClient, target: ForumTarget) {
  const rows = target.kind === "thread"
    ? await tx.$queryRaw<LockedContent[]>`
      SELECT t.id, t."userId", t.status, t."moderationVersion", t."barrioId", b.slug AS "barrioSlug",
             s.slug AS "subforumSlug", t.id AS "threadId", t."userId" AS "threadAuthorId",
             NULL AS "parentReplyId", NULL AS "publishedAt"
      FROM "ForumThread" t
      JOIN "Barrio" b ON b.id = t."barrioId"
      JOIN "ForumSubforum" s ON s.id = t."subforumId"
      WHERE t.id = ${target.id} AND t."deletedAt" IS NULL
      FOR UPDATE OF t
    `
    : await tx.$queryRaw<LockedContent[]>`
      SELECT r.id, r."userId", r.status, r."moderationVersion", t."barrioId", b.slug AS "barrioSlug",
             s.slug AS "subforumSlug", t.id AS "threadId", t."userId" AS "threadAuthorId",
             r."parentReplyId", r."publishedAt"
      FROM "ForumReply" r
      JOIN "ForumThread" t ON t.id = r."threadId"
      JOIN "Barrio" b ON b.id = t."barrioId"
      JOIN "ForumSubforum" s ON s.id = t."subforumId"
      WHERE r.id = ${target.id} AND t."deletedAt" IS NULL
      FOR UPDATE OF r
    `;
  if (!rows[0]) throw new ApiError(404, target.kind === "thread" ? "Hilo no encontrado" : "Respuesta no encontrada");
  return rows[0];
}

async function loadModeratedContent(tx: Prisma.TransactionClient, target: ForumTarget) {
  return target.kind === "thread"
    ? tx.forumThread.findUniqueOrThrow({ where: { id: target.id }, omit: internalOmit, include: queueInclude("thread") })
    : tx.forumReply.findUniqueOrThrow({ where: { id: target.id }, omit: internalOmit, include: queueInclude("reply") });
}

export const forumModerationService = {
  async getQueue(userId: string, opts: ForumQueueQuery) {
    const user = await getModerator(userId);
    const barrioId = await resolveQueueBarrio(user, opts.barrioSlug);
    const skip = (opts.page - 1) * opts.limit;

    const queueFilter = opts.queue === "REPORTED"
      ? { reports: { some: { status: ForumReportStatus.OPEN } } }
      : opts.queue === "APPEALED"
        ? { appeals: { some: { status: ForumAppealStatus.PENDING } } }
        : { status: opts.queue };

    if (opts.target === "THREAD") {
      const where: Prisma.ForumThreadWhereInput = { deletedAt: null, ...(barrioId ? { barrioId } : {}), ...queueFilter };
      const [items, total] = await Promise.all([
        prisma.forumThread.findMany({ where, skip, take: opts.limit, orderBy: { updatedAt: "desc" }, omit: internalOmit, include: queueInclude("thread") }),
        prisma.forumThread.count({ where })
      ]);
      return { items, total, page: opts.page, limit: opts.limit };
    }

    const where: Prisma.ForumReplyWhereInput = {
      thread: { deletedAt: null, ...(barrioId ? { barrioId } : {}) },
      ...queueFilter
    };
    const [items, total] = await Promise.all([
      prisma.forumReply.findMany({ where, skip, take: opts.limit, orderBy: { updatedAt: "desc" }, omit: internalOmit, include: queueInclude("reply") }),
      prisma.forumReply.count({ where })
    ]);
    return { items, total, page: opts.page, limit: opts.limit };
  },

  async moderate(userId: string, target: ForumTarget, input: ModerateForumDecisionInput) {
    const user = await getModerator(userId);

    const apply = () => serializable(async (tx) => {
      const existing = await tx.forumModerationDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (!sameDecisionRequest(existing, userId, target, input)) throw new ApiError(409, "IDEMPOTENCY_KEY_IN_USE");
        return loadModeratedContent(tx, target);
      }

      const content = await lockContent(tx, target);
      assertBarrioAccess(user, content.barrioId);
      if (content.moderationVersion !== input.expectedVersion) throw new ApiError(409, "MODERATION_VERSION_CONFLICT");

      const [pendingAppeal, openReports] = await Promise.all([
        tx.forumAppeal.findFirst({ where: { ...targetKey(target), status: ForumAppealStatus.PENDING }, select: { id: true } }),
        tx.forumReport.count({ where: { ...targetKey(target), status: ForumReportStatus.OPEN } })
      ]);
      const transition = transitionFor(content.status, input.decision, {
        hasPendingAppeal: Boolean(pendingAppeal),
        hasOpenReports: openReports > 0
      });
      if (transition.status === ForumContentStatus.PUBLISHED && content.userId === userId) {
        throw new ApiError(403, "CANNOT_MODERATE_OWN_CONTENT");
      }

      const publishes = transition.status === ForumContentStatus.PUBLISHED;
      const overriddenRuleId = publishes && isRetained(content.status) ? await findOverriddenRule(tx, target) : null;
      const rowUpdate = {
        status: transition.status,
        // Publicado no necesita motivo; en otro caso el autor ve el código elegido por el equipo.
        moderationReasonCode: publishes ? null : input.reasonCode,
        moderationRuleId: HUMAN_HOLD_RULES.manual,
        moderationPolicyVersion: MANUAL_REVIEW_POLICY_VERSION,
        moderationVersion: { increment: 1 }
      };
      const updated = target.kind === "thread"
        ? await tx.forumThread.updateMany({ where: { id: target.id, moderationVersion: input.expectedVersion, deletedAt: null }, data: rowUpdate })
        : await tx.forumReply.updateMany({ where: { id: target.id, moderationVersion: input.expectedVersion }, data: rowUpdate });
      if (updated.count !== 1) throw new ApiError(409, "MODERATION_VERSION_CONFLICT");

      const decision = await tx.forumModerationDecision.create({
        data: {
          ...targetKey(target),
          barrioId: content.barrioId,
          actorId: userId,
          action: transition.action,
          fromStatus: content.status,
          toStatus: transition.status,
          fromVersion: input.expectedVersion,
          toVersion: input.expectedVersion + 1,
          reasonCode: input.reasonCode,
          privateNote: input.privateNote,
          ruleId: HUMAN_HOLD_RULES.manual,
          overriddenRuleId,
          policyVersion: MANUAL_REVIEW_POLICY_VERSION,
          categories: [input.reasonCode],
          idempotencyKey: input.idempotencyKey,
          appealId: pendingAppeal?.id,
          evidence: { openReports, actorRole: user.role }
        }
      });

      moderationMetrics.manualDecisions.inc({ domain: "FORUM", action: transition.action });

      if (openReports > 0) {
        await tx.forumReport.updateMany({
          where: { ...targetKey(target), status: ForumReportStatus.OPEN },
          data: {
            // Si el contenido sigue publicado los reportes se desestiman; si se retiró, se resuelven.
            status: publishes ? ForumReportStatus.DISMISSED : ForumReportStatus.RESOLVED,
            resolvedAt: new Date(),
            resolvedById: userId,
            resolutionDecisionId: decision.id
          }
        });
      }
      if (pendingAppeal) {
        await tx.forumAppeal.update({
          where: { id: pendingAppeal.id },
          data: {
            status: transition.action === ForumModerationAction.APPEAL_ACCEPT ? ForumAppealStatus.ACCEPTED : ForumAppealStatus.REJECTED,
            resolvedAt: new Date(),
            resolvedById: userId,
            resolutionDecisionId: decision.id
          }
        });
      }

      // Aprobar una respuesta retenida la publica y notifica una sola vez.
      if (target.kind === "reply" && publishes) {
        await publishReplyOnce(tx, content, {
          barrioSlug: content.barrioSlug,
          subforumSlug: content.subforumSlug,
          threadId: content.threadId,
          threadAuthorId: content.threadAuthorId
        });
      }

      return loadModeratedContent(tx, target);
    });

    try {
      return await apply();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.forumModerationDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (existing && sameDecisionRequest(existing, userId, target, input)) {
          return prisma.$transaction((tx) => loadModeratedContent(tx, target));
        }
        throw new ApiError(409, existing ? "IDEMPOTENCY_KEY_IN_USE" : "MODERATION_VERSION_CONFLICT");
      }
      throw error;
    }
  },

  // Cuántas veces cada regla automática retuvo contenido y cuántas lo revirtió una persona.
  // Una tasa de override alta señala una regla con demasiados falsos positivos.
  async getMetrics(userId: string, opts: { barrioSlug?: string }) {
    const user = await getModerator(userId);
    const barrioId = await resolveQueueBarrio(user, opts.barrioSlug);
    const barrioFilter = barrioId ? { barrioId } : {};

    const [retained, overridden] = await Promise.all([
      prisma.forumModerationDecision.groupBy({
        by: ["ruleId"],
        where: {
          ...barrioFilter,
          action: { in: [ForumModerationAction.AUTO_REVIEW, ForumModerationAction.OWNER_EDIT] },
          toStatus: { in: [ForumContentStatus.PENDING_REVIEW, ForumContentStatus.BLOCKED] },
          ruleId: { notIn: Object.values(HUMAN_HOLD_RULES) }
        },
        _count: { _all: true }
      }),
      prisma.forumModerationDecision.groupBy({
        by: ["overriddenRuleId"],
        where: { ...barrioFilter, overriddenRuleId: { not: null } },
        _count: { _all: true }
      })
    ]);

    const overrides = new Map(overridden.map((row) => [row.overriddenRuleId, row._count._all]));
    const rules = retained
      .filter((row): row is typeof row & { ruleId: string } => row.ruleId !== null)
      .map((row) => {
        const overriddenCount = overrides.get(row.ruleId) ?? 0;
        return {
          ruleId: row.ruleId,
          retained: row._count._all,
          overridden: overriddenCount,
          overrideRate: Number((overriddenCount / row._count._all).toFixed(3))
        };
      })
      .sort((a, b) => b.overrideRate - a.overrideRate || b.retained - a.retained);

    return { scope: barrioId ? "BARRIO" : user.role === UserRole.ADMIN ? "GLOBAL" : "BARRIO", rules };
  }
};
