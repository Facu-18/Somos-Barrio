import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(2).max(120),
  barrioSlug: z.string().min(2).max(120).optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(64).max(256)
});

export const mobileLogoutSchema = refreshTokenSchema.extend({
  pushToken: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/).optional()
});

export const updateProfileSchema = z.object({
  nickname: z.string().min(2, "El apodo es muy corto").max(30, "El apodo es muy largo").nullable().optional(),
  bio: z.string().max(160, "La biografía es muy larga").optional(),
  avatarUrl: z.string().url("URL de imagen inválida").optional().or(z.literal("")),
  avatarPublicId: z.string().max(255).regex(/^[A-Za-z0-9/_-]*$/, "ID de imagen invalido").optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "El cuerpo de la petición no puede estar vacío"
}).refine(data => {
  const hasUrl = data.avatarUrl !== undefined;
  const hasPublicId = data.avatarPublicId !== undefined;
  return hasUrl === hasPublicId && (!hasUrl || (data.avatarUrl === "") === (data.avatarPublicId === ""));
}, {
  message: "avatarUrl y avatarPublicId deben enviarse juntos",
  path: ["avatarUrl"]
});
