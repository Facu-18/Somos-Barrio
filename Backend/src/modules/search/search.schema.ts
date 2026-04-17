import { z } from "zod";

const SearchType = z.enum(["news", "businesses", "marketplace", "forum"]);

export const searchQuerySchema = z.object({
  q: z.string().min(2).max(100).trim(),
  barrioSlug: z.string().optional(),
  types: z
    .string()
    .optional()
    .transform((val) =>
      val ? (val.split(",").filter((t) => ["news", "businesses", "marketplace", "forum"].includes(t)) as z.infer<typeof SearchType>[]) : ["news", "businesses", "marketplace", "forum"]
    ),
  limit: z.coerce.number().int().positive().max(20).default(5)
});
