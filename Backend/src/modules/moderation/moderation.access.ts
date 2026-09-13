import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";

export async function getModerator(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "Usuario no encontrado");
  if (user.role !== UserRole.EDITOR && user.role !== UserRole.ADMIN) {
    throw new ApiError(403, "No tenés permisos para moderar");
  }
  return user;
}

export type Moderator = Awaited<ReturnType<typeof getModerator>>;

export function assertBarrioAccess(user: { role: UserRole; barrioId: string | null }, barrioId: string | null) {
  if (user.role === UserRole.EDITOR && (!user.barrioId || user.barrioId !== barrioId)) {
    throw new ApiError(403, "No podés moderar contenido de otros barrios");
  }
}

// Editores quedan fijos en su barrio; administradores pueden filtrar por uno o ver todos.
export async function resolveQueueBarrio(user: Moderator, barrioSlug?: string) {
  if (user.role === UserRole.EDITOR) {
    if (!user.barrioId) throw new ApiError(403, "Editor sin barrio asignado");
    return user.barrioId;
  }
  if (!barrioSlug) return undefined;
  const barrio = await prisma.barrio.findUnique({ where: { slug: barrioSlug }, select: { id: true } });
  if (!barrio) throw new ApiError(404, "Barrio filtrado no encontrado");
  return barrio.id;
}

// Prisma informa el conflicto de serialización como P2034, salvo dentro de $queryRaw (p. ej. un
// SELECT ... FOR UPDATE), donde llega como P2010 con el código de Postgres 40001.
function isSerializationFailure(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return error.code === "P2034" || (error.code === "P2010" && (error.meta as { code?: string } | undefined)?.code === "40001");
}

export async function serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isSerializationFailure(error)) throw error;
    }
  }
  throw new ApiError(409, "MODERATION_VERSION_CONFLICT");
}
