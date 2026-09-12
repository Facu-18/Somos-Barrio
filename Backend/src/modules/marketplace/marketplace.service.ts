import { MarketplaceAvailability, ModerationStatus, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { contentModerationService } from "../content-moderation/content-moderation.service";
import axios from "axios";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

type CreatePostInput = {
  title: string;
  description: string;
  price?: number;
  currency: string;
  category: string;
  images: string[];
  location?: string;
  whatsapp: string;
};

type UpdatePostInput = Partial<{
  title: string;
  description: string;
  price: number;
  category: string;
  availability: MarketplaceAvailability;
  images: string[];
  location: string;
  whatsapp: string;
}>;

const userSelect = { id: true, nickname: true, avatarUrl: true };

function normalizeWhatsapp(value: string): string {
  const trimmed = value.trim();
  if (/[A-Za-z]/.test(trimmed)) throw new ApiError(400, "Numero de WhatsApp invalido");
  const digits = (trimmed.startsWith("00") ? trimmed.slice(2) : trimmed).replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new ApiError(400, "Numero de WhatsApp invalido");
  return `+${digits}`;
}

async function resolveBarrio(barrioSlug: string) {
  const barrio = await prisma.barrio.findUnique({ where: { slug: barrioSlug } });
  if (!barrio) throw new ApiError(404, "Barrio no encontrado");
  return barrio;
}

function contentForModeration(post: { title: string; description: string; category: string; location?: string | null }) {
  return [post.title, post.description, post.category, post.location].filter(Boolean).join("\n");
}

function initialModerationStatus(decision: "ALLOW" | "REVIEW" | "BLOCK") {
  if (decision === "BLOCK") return ModerationStatus.REJECTED;
  if (decision === "REVIEW") return ModerationStatus.PENDING_REVIEW;
  return ModerationStatus.APPROVED;
}

export async function extractMarketplaceImageText(images: string[]) {
  if (images.length === 0) return { text: "", available: true };
  if (!env.SIGHTENGINE_API_USER || !env.SIGHTENGINE_API_SECRET) {
    logger.warn("OCR de marketplace no disponible: falta configuración de Sightengine");
    return { text: "", available: false };
  }

  try {
    const responses = await Promise.all(images.map((url) => axios.get("https://api.sightengine.com/1.0/check.json", {
      params: {
        url,
        models: "ocr",
        api_user: env.SIGHTENGINE_API_USER,
        api_secret: env.SIGHTENGINE_API_SECRET
      },
      timeout: 8_000
    })));
    if (responses.some((response) => response.data?.status !== "success")) {
      throw new Error("OCR provider returned an unsuccessful result");
    }
    return {
      text: responses.map((response) => response.data?.text?.content ?? "").join("\n"),
      available: true
    };
  } catch {
    logger.warn("OCR de marketplace no disponible: falló el proveedor");
    return { text: "", available: false };
  }
}

export const marketplaceService = {
  async list(barrioSlug: string, opts: { category?: string; page: number; limit: number }) {
    const barrio = await resolveBarrio(barrioSlug);
    const skip = (opts.page - 1) * opts.limit;

    const where = {
      barrioId: barrio.id,
      availability: MarketplaceAvailability.AVAILABLE,
      moderationStatus: ModerationStatus.APPROVED,
      ...(opts.category ? { category: opts.category as any } : {})
    };

    const [items, total] = await Promise.all([
      prisma.marketplacePost.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          currency: true,
          category: true,
          availability: true,
          moderationStatus: true,
          moderationReasonCode: true,
          images: true,
          location: true,
          views: true,
          createdAt: true,
          user: { select: userSelect }
        }
      }),
      prisma.marketplacePost.count({ where })
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  },

  async listMe(barrioSlug: string, userId: string, opts: { page: number; limit: number }) {
    const barrio = await resolveBarrio(barrioSlug);
    const skip = (opts.page - 1) * opts.limit;

    const where = {
      barrioId: barrio.id,
      userId
    };

    const [items, total] = await Promise.all([
      prisma.marketplacePost.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: userSelect } }
      }),
      prisma.marketplacePost.count({ where })
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  },

  async getById(barrioSlug: string, postId: string, requesterId: string, requesterRole: UserRole) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({
      where: { id: postId, barrioId: barrio.id },
      include: { user: { select: userSelect } }
    });

    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    const isOwnerOrModerator =
      post.userId === requesterId ||
      requesterRole === UserRole.EDITOR ||
      requesterRole === UserRole.ADMIN;
    
    // Si no es el dueño ni un admin, la publicación debe estar aprobada y disponible.
    if (!isOwnerOrModerator) {
      if (post.availability !== MarketplaceAvailability.AVAILABLE || post.moderationStatus !== ModerationStatus.APPROVED) {
        throw new ApiError(404, "Publicacion no encontrada");
      }
    }

    return prisma.marketplacePost.update({
      where: { id: post.id },
      data: { views: { increment: 1 } },
      include: { user: { select: userSelect } }
    });
  },

  async create(barrioSlug: string, userId: string, input: CreatePostInput) {
    const barrio = await resolveBarrio(barrioSlug);

    // Evaluar contenido para moderación
    const imageText = await extractMarketplaceImageText(input.images);
    const contentToEvaluate = [contentForModeration(input), imageText.text].filter(Boolean).join("\n");
    const moderationResult = contentModerationService.evaluate(contentToEvaluate, 'MARKETPLACE');
    const imageNeedsReview = !imageText.available && moderationResult.decision === 'ALLOW';
    const modStatus = imageNeedsReview
      ? ModerationStatus.PENDING_REVIEW
      : initialModerationStatus(moderationResult.decision);
    const moderationReasonCode = imageNeedsReview
      ? 'IMAGE_REVIEW'
      : moderationResult.categories[0] ?? null;

    return prisma.marketplacePost.create({
      data: {
        ...input,
        category: input.category as any,
        whatsapp: normalizeWhatsapp(input.whatsapp),
        userId,
        barrioId: barrio.id,
        moderationStatus: modStatus,
        moderationReasonCode,
        decisions: {
          create: {
            status: modStatus,
            reason: moderationReasonCode ?? "Automated approval",
            ruleId: imageNeedsReview ? 'IMAGE_OCR_UNAVAILABLE' : moderationResult.ruleId,
            ruleVersion: imageNeedsReview ? 'image-ocr-1' : moderationResult.ruleVersion,
            policyVersion: moderationResult.policyVersion,
            domain: moderationResult.domain,
            severity: imageNeedsReview ? 'MEDIUM' : moderationResult.severity,
            contentHash: moderationResult.contentHash,
            categories: imageNeedsReview ? ['IMAGE_REVIEW'] : moderationResult.categories
          }
        }
      },
      include: { user: { select: userSelect } }
    });
  },

  async update(
    barrioSlug: string,
    postId: string,
    requesterId: string,
    requesterRole: UserRole,
    input: UpdatePostInput
  ) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({ where: { id: postId, barrioId: barrio.id } });
    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    if (post.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para editar esta publicacion");
    }

    const materialChanged =
      (input.title !== undefined && input.title !== post.title) ||
      (input.description !== undefined && input.description !== post.description) ||
      (input.price !== undefined && input.price !== post.price) ||
      (input.category !== undefined && input.category !== post.category) ||
      (input.location !== undefined && input.location !== post.location) ||
      (input.images !== undefined && JSON.stringify(input.images) !== JSON.stringify(post.images));

    let modStatus = post.moderationStatus;
    let moderationReasonCode = post.moderationReasonCode;
    let decisionCreate;

    if (materialChanged) {
      const candidate = {
        title: input.title ?? post.title,
        description: input.description ?? post.description,
        category: input.category ?? post.category,
        location: input.location ?? post.location
      };
      const candidateImages = input.images ?? post.images;
      const imageText = await extractMarketplaceImageText(candidateImages);
      const candidateContent = [contentForModeration(candidate), imageText.text].filter(Boolean).join("\n");
      const result = contentModerationService.evaluate(candidateContent, 'MARKETPLACE');
      const cleanContentRequiresReview = result.decision === 'ALLOW';

      // Clean edits still require a human to restore public visibility.
      modStatus = result.decision === 'BLOCK' ? ModerationStatus.REJECTED : ModerationStatus.PENDING_REVIEW;
      moderationReasonCode = !imageText.available && cleanContentRequiresReview
        ? 'IMAGE_REVIEW'
        : result.categories[0] ?? 'CONTENT_CHANGED';
      decisionCreate = {
        status: modStatus,
        reason: result.categories.length ? result.categories.join(", ") : "Material content changed",
        ruleId: cleanContentRequiresReview
          ? moderationReasonCode === 'IMAGE_REVIEW' ? 'IMAGE_OCR_UNAVAILABLE' : 'MATERIAL_CHANGE_REVIEW'
          : result.ruleId,
        ruleVersion: cleanContentRequiresReview
          ? moderationReasonCode === 'IMAGE_REVIEW' ? 'image-ocr-1' : 'marketplace-edit-1'
          : result.ruleVersion,
        policyVersion: result.policyVersion,
        domain: result.domain,
        severity: cleanContentRequiresReview ? 'MEDIUM' : result.severity,
        contentHash: result.contentHash,
        categories: cleanContentRequiresReview ? [moderationReasonCode] : result.categories
      };
    }

    return prisma.marketplacePost.update({
      where: { id: post.id },
      data: { 
        ...input, 
        category: input.category as any,
        ...(input.whatsapp !== undefined ? { whatsapp: normalizeWhatsapp(input.whatsapp) } : {}),
        moderationStatus: modStatus,
        moderationReasonCode,
        ...(decisionCreate ? { decisions: { create: decisionCreate } } : {})
      },
      include: { user: { select: userSelect } }
    });
  },

  async remove(barrioSlug: string, postId: string, requesterId: string, requesterRole: UserRole) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({ where: { id: postId, barrioId: barrio.id } });
    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    if (post.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para eliminar esta publicacion");
    }

    await prisma.marketplacePost.delete({ where: { id: post.id } });
  },

  async report(barrioSlug: string, postId: string, requesterId: string, input: { category: string; comment?: string }) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({
      where: {
        id: postId,
        barrioId: barrio.id,
        availability: MarketplaceAvailability.AVAILABLE,
        moderationStatus: ModerationStatus.APPROVED
      }
    });
    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    if (post.userId === requesterId) {
      throw new ApiError(400, "No podés reportar tu propia publicación");
    }

    const existingReport = await prisma.marketplaceReport.findUnique({
      where: { postId_reporterId: { postId, reporterId: requesterId } }
    });

    if (existingReport) {
      throw new ApiError(409, "Ya reportaste esta publicación");
    }

    await prisma.$transaction(async (tx) => {
      await tx.marketplaceReport.create({
        data: {
          postId,
          reporterId: requesterId,
          category: input.category as any,
          comment: input.comment
        }
      });

      const reportsCount = await tx.marketplaceReport.count({ where: { postId } });

      // Auto-ocultamiento si llega a 3 reportes
      if (reportsCount >= 3 && post.moderationStatus === ModerationStatus.APPROVED) {
        await tx.marketplacePost.update({
          where: { id: postId },
          data: {
            moderationStatus: ModerationStatus.PENDING_REVIEW,
            moderationReasonCode: "REPORT_THRESHOLD"
          }
        });

        await tx.marketplaceModerationDecision.create({
          data: {
            postId,
            status: ModerationStatus.PENDING_REVIEW,
            reason: "Auto-ocultamiento por umbral de reportes (>=3)",
            ruleId: "REPORT_THRESHOLD",
            ruleVersion: "reports-1",
            policyVersion: "reports-1",
            domain: "MARKETPLACE",
            severity: "MEDIUM",
            categories: ["REPORT_THRESHOLD"]
          }
        });
      }
    });
  }
};
