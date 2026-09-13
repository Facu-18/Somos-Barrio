import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { UserRole, ModerationStatus } from "@prisma/client";
import { ModerateMarketplaceDecisionInput } from "./moderation.schema";
import { presentMarketplacePost } from "../marketplace/marketplace.service";

export const moderationService = {
  /**
   * Obtiene la cola de moderación.
   * Si el rol es EDITOR, filtra automáticamente por su barrio.
   * Si es ADMIN, permite ver todos, o filtrar por barrio.
   */
  async getMarketplaceQueue(
    userId: string,
    opts: {
      status?: ModerationStatus;
      barrioSlug?: string;
      page: number;
      limit: number;
    }
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, "Usuario no encontrado");
    if (user.role !== UserRole.EDITOR && user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "No tenés permisos para moderar publicaciones");
    }

    let barrioIdFilter: string | undefined;

    if (user.role === UserRole.EDITOR) {
      if (!user.barrioId) throw new ApiError(403, "Editor sin barrio asignado");
      barrioIdFilter = user.barrioId;
    } else if (user.role === UserRole.ADMIN) {
      if (opts.barrioSlug) {
        const barrio = await prisma.barrio.findUnique({ where: { slug: opts.barrioSlug } });
        if (!barrio) throw new ApiError(404, "Barrio filtrado no encontrado");
        barrioIdFilter = barrio.id;
      }
    }

    const where: any = {};
    if (barrioIdFilter) where.barrioId = barrioIdFilter;
    if (opts.status) {
      where.moderationStatus = opts.status;
    } else {
      // Por defecto, mostrar los pendientes de revisión o rechazados (no eliminados a menos que se pidan explicitamente)
      where.moderationStatus = { in: [ModerationStatus.PENDING_REVIEW, ModerationStatus.REJECTED] };
    }

    const skip = (opts.page - 1) * opts.limit;

    const [items, total] = await Promise.all([
      prisma.marketplacePost.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { updatedAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          barrio: { select: { id: true, name: true, slug: true } },
          reports: { select: { id: true, category: true, comment: true, createdAt: true, reporter: { select: { name: true } } } },
          decisions: { orderBy: { createdAt: "desc" }, select: { status: true, reason: true, privateNote: true, moderator: { select: { name: true } }, createdAt: true } },
          assets: { select: { id: true, url: true }, orderBy: { createdAt: "asc" } }
        }
      }),
      prisma.marketplacePost.count({ where })
    ]);

    return {
      items: items.map((post) => ({
        ...presentMarketplacePost(post),
        legacyImages: post.legacyImages
      })),
      total,
      page: opts.page,
      limit: opts.limit
    };
  },

  /**
   * Ejecuta una decisión atómica manual sobre un post.
   */
  async moderateMarketplacePost(userId: string, postId: string, input: ModerateMarketplaceDecisionInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, "Usuario no encontrado");
    if (user.role !== UserRole.EDITOR && user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "No tenés permisos para moderar publicaciones");
    }

    const post = await prisma.marketplacePost.findUnique({
      where: { id: postId },
      include: { assets: { select: { id: true, url: true }, orderBy: { createdAt: "asc" } } }
    });
    if (!post) throw new ApiError(404, "Publicación no encontrada");

    // Autorización
    if (user.role === UserRole.EDITOR && user.barrioId !== post.barrioId) {
      throw new ApiError(403, "No podés moderar publicaciones de otros barrios");
    }

    let newStatus: ModerationStatus;
    switch (input.decision) {
      case "APPROVE":
        newStatus = ModerationStatus.APPROVED;
        break;
      case "REJECT":
        newStatus = ModerationStatus.REJECTED;
        break;
      case "REMOVE":
        newStatus = ModerationStatus.REMOVED;
        break;
      case "RESTORE":
        newStatus = ModerationStatus.APPROVED;
        break;
    }

    if (newStatus === ModerationStatus.APPROVED && post.userId === userId) {
      throw new ApiError(403, "No podés aprobar tu propia publicación");
    }

    if (post.moderationStatus === newStatus) {
       // Operación idempotente: si ya está en ese estado, no repetimos la decisión.
        return presentMarketplacePost(post);
    }

    // Append-only decision + Update post
    const updatedPost = await prisma.$transaction(async (tx) => {
      await tx.marketplaceModerationDecision.create({
        data: {
          postId,
          moderatorId: userId,
          status: newStatus,
          reason: input.reason,
          privateNote: input.privateNote,
          ruleId: "MANUAL_REVIEW",
          ruleVersion: "manual-1",
          policyVersion: "manual-1",
          domain: "MARKETPLACE",
          severity: newStatus === ModerationStatus.APPROVED ? "NONE" : "HIGH",
          categories: []
        }
      });

      return tx.marketplacePost.update({
        where: { id: postId },
        data: {
          moderationStatus: newStatus,
          moderationReasonCode: newStatus === ModerationStatus.APPROVED ? null : "MANUAL_REVIEW"
        },
        include: { assets: { select: { id: true, url: true }, orderBy: { createdAt: "asc" } } }
      });
    });

    return presentMarketplacePost(updatedPost);
  }
};
