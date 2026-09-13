import { createHash } from "node:crypto";
import { NewsAiOperation, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import type { AiGenerationMeta } from "./ai.provider";

export const AI_GENERATION_STALE_CODE = "AI_GENERATION_STALE";
export const AI_GENERATION_MISMATCH_CODE = "AI_GENERATION_MISMATCH";
export const AI_GENERATION_ALREADY_APPLIED_CODE = "AI_GENERATION_ALREADY_APPLIED";

export type NewsSource = { title: string; excerpt: string | null; content: string };

// Huella del contenido sobre el que se generó una sugerencia; si cambia, la sugerencia quedó obsoleta.
export function newsSourceHash(source: NewsSource) {
  return createHash("sha256")
    .update(JSON.stringify({ title: source.title, excerpt: source.excerpt || null, content: source.content }))
    .digest("hex");
}

export async function recordNewsAiGeneration(params: {
  operation: NewsAiOperation;
  newsId?: string;
  barrioId: string;
  requestedById: string;
  source: NewsSource;
  output: { summary: string; excerpt?: string; content?: string };
  meta: AiGenerationMeta;
}) {
  const sourceHash = newsSourceHash(params.source);
  const generation = await prisma.newsAiGeneration.create({
    data: {
      operation: params.operation,
      newsId: params.newsId,
      barrioId: params.barrioId,
      requestedById: params.requestedById,
      promptVersion: params.meta.promptVersion,
      provider: params.meta.provider,
      model: params.meta.model,
      finishReason: params.meta.finishReason,
      sourceHash,
      output: params.output
    }
  });

  return {
    generationId: generation.id,
    operation: generation.operation,
    promptVersion: generation.promptVersion,
    provider: generation.provider,
    model: generation.model,
    generatedAt: generation.createdAt,
    sourceHash,
    // El original viaja junto a la sugerencia para que la app muestre el diff antes de aplicarla.
    original: { title: params.source.title, excerpt: params.source.excerpt || null, content: params.source.content },
    suggestion: params.output
  };
}

/**
 * Reclama una generación para aplicarla al publicar. Debe pertenecer a la noticia, haberse
 * generado sobre su contenido actual y no haberse aplicado antes. Devuelve los metadatos que
 * se guardan en `aiSummary`, tomados del servidor.
 */
export async function claimNewsAiGeneration(
  tx: Prisma.TransactionClient,
  params: { generationId: string; newsId: string; source: NewsSource; appliedById: string; summary: string }
) {
  const generation = await tx.newsAiGeneration.findUnique({ where: { id: params.generationId } });
  if (!generation || generation.newsId !== params.newsId || generation.operation === NewsAiOperation.ASSIST) {
    throw new ApiError(409, "La sugerencia de IA no corresponde a esta noticia.", { code: AI_GENERATION_MISMATCH_CODE });
  }
  if (generation.appliedAt) {
    throw new ApiError(409, "La sugerencia de IA ya fue aplicada.", { code: AI_GENERATION_ALREADY_APPLIED_CODE });
  }
  if (generation.sourceHash !== newsSourceHash(params.source)) {
    throw new ApiError(409, "La noticia cambió desde que se generó la sugerencia. Generá una nueva.", { code: AI_GENERATION_STALE_CODE });
  }

  const claimed = await tx.newsAiGeneration.updateMany({
    where: { id: generation.id, appliedAt: null },
    data: { appliedAt: new Date(), appliedById: params.appliedById }
  });
  if (claimed.count !== 1) {
    throw new ApiError(409, "La sugerencia de IA ya fue aplicada.", { code: AI_GENERATION_ALREADY_APPLIED_CODE });
  }

  return {
    summary: params.summary,
    provider: generation.provider,
    model: generation.model,
    promptVersion: generation.promptVersion,
    generationId: generation.id,
    generatedAt: generation.createdAt.toISOString()
  };
}
