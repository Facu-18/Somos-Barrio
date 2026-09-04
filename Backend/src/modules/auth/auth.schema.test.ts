import { describe, expect, it } from "vitest";
import { updateProfileSchema } from "./auth.schema";

describe("updateProfileSchema", () => {
  it("requiere URL e ID de avatar juntos", () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: "https://res.cloudinary.com/demo/image/upload/somos-barrio/a.jpg" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ avatarPublicId: "somos-barrio/a" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ avatarUrl: "", avatarPublicId: "" }).success).toBe(true);
  });
});
