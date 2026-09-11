import { MarketplaceAvailability, ModerationStatus, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { contentModerationService } from "../content-moderation/content-moderation.service";

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

    const isOwnerOrAdmin = post.userId === requesterId || requesterRole === UserRole.ADMIN;
    
    // Si no es el dueño ni un admin, la publicación debe estar aprobada y disponible.
    if (!isOwnerOrAdmin) {
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
    const contentToEvaluate = `${input.title} ${input.description} ${input.location || ""}`;
    const moderationResult = contentModerationService.evaluate(contentToEvaluate, 'MARKETPLACE');
    
    const statusMap: Record<string, ModerationStatus> = {
      ALLOW: ModerationStatus.APPROVED,
      REVIEW: ModerationStatus.PENDING_REVIEW,
      BLOCK: ModerationStatus.REJECTED
    };
    
    const modStatus = statusMap[moderationResult.decision];

    return prisma.marketplacePost.create({
      data: {
        ...input,
        category: input.category as any,
        whatsapp: normalizeWhatsapp(input.whatsapp),
        userId,
        barrioId: barrio.id,
        moderationStatus: modStatus,
        decisions: {
          create: {
            status: modStatus,
            ruleId: moderationResult.ruleId,
            policyVersion: moderationResult.policyVersion
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

    let modStatus = post.moderationStatus;
    let decisionCreate: any = undefined;

    const titleChanged = input.title && input.title !== post.title;
    const descChanged = input.description && input.description !== post.description;
    const locChanged = input.location !== undefined && input.location !== post.location;

    // Reevaluación obligatoria en caso de cambio de contenido textual.
    if (titleChanged || descChanged || locChanged) {
       const newTitle = input.title ?? post.title;
       const newDesc = input.description ?? post.description;
       const newLoc = input.location !== undefined ? input.location : post.location;

       const contentToEvaluate = `${newTitle} ${newDesc} ${newLoc || ""}`;
       const modResult = contentModerationService.evaluate(contentToEvaluate, 'MARKETPLACE');
       
       const statusMap: Record<string, ModerationStatus> = {
         ALLOW: ModerationStatus.APPROVED,
         REVIEW: ModerationStatus.PENDING_REVIEW,
         BLOCK: ModerationStatus.REJECTED
       };
       modStatus = statusMap[modResult.decision];

       decisionCreate = {
         status: modStatus,
         reason: "Automated re-evaluation after update",
         ruleId: modResult.ruleId,
         policyVersion: modResult.policyVersion
       };
    }

    return prisma.marketplacePost.update({
      where: { id: post.id },
      data: { 
        ...input, 
        category: input.category as any,
        ...(input.whatsapp !== undefined ? { whatsapp: normalizeWhatsapp(input.whatsapp) } : {}),
        moderationStatus: modStatus,
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
  }
};
