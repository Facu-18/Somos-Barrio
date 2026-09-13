import { describe, expect, it } from "vitest";
import { createMarketplacePostSchema, updateMarketplacePostSchema } from "./marketplace.schema";
import { presentMarketplacePost } from "./marketplace.service";

describe("marketplace asset contract", () => {
  it("rejects the former external URL input on create and update", () => {
    const base = { title: "Mesa usada", description: "En buen estado", category: "MUEBLES", whatsapp: "+5493515550101" };
    expect(createMarketplacePostSchema.safeParse({ ...base, images: ["https://external.test/image.jpg"] }).success).toBe(false);
    expect(updateMarketplacePostSchema.safeParse({ images: ["https://external.test/image.jpg"] }).success).toBe(false);
  });

  it("rejects duplicate asset IDs", () => {
    const assetId = "cm1234567890123456789012";
    expect(createMarketplacePostSchema.safeParse({
      title: "Mesa usada", description: "En buen estado", category: "MUEBLES",
      whatsapp: "+5493515550101", assetIds: [assetId, assetId]
    }).success).toBe(false);
  });

  it("derives public images from managed assets and hides legacy references", () => {
    const presented = presentMarketplacePost({
      id: "post-1",
      images: ["https://legacy.test/unsafe.jpg"],
      legacyImages: ["https://legacy.test/preserved.jpg"],
      assets: [{ id: "asset-1", url: "https://cdn.test/safe.jpg" }]
    });
    expect(presented).toEqual({
      id: "post-1", images: ["https://cdn.test/safe.jpg"], assetIds: ["asset-1"]
    });
    expect(JSON.stringify(presented)).not.toContain("legacy.test");
  });
});
