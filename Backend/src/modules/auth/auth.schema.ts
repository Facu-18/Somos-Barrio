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
