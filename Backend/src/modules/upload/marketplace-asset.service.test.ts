import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assetCreate: vi.fn(),
  assetUpdate: vi.fn(),
  assetUpdateMany: vi.fn(),
  assetFindMany: vi.fn(),
  assetDeleteMany: vi.fn(),
  decisionCount: vi.fn(),
  scan: vi.fn(),
  evaluate: vi.fn(),
  uploadStream: vi.fn(),
  destroy: vi.fn(),
  warn: vi.fn()
}));

vi.mock("../../config/env", () => ({ env: {
  SIGHTENGINE_THRESHOLDS: {
    nudity: { review: 0.31, block: 0.71 }, sexual: { review: 0.32, block: 0.72 },
    violence: { review: 0.33, block: 0.73 }, gore: { review: 0.34, block: 0.74 },
    weapons: { review: 0.35, block: 0.75 }, drugs: { review: 0.36, block: 0.76 },
    alcohol: { review: 0.37, block: 0.77 }, tobacco: { review: 0.38, block: 0.78 },
    offensiveSymbols: { review: 0.39, block: 0.79 }
  },
  CLOUDINARY_CLOUD_NAME: "cloud",
  CLOUDINARY_API_KEY: "key",
  CLOUDINARY_API_SECRET: "secret",
  MARKETPLACE_ASSET_ORPHAN_TTL_MS: 86_400_000,
  MARKETPLACE_ASSET_REVIEW_TTL_MS: 604_800_000
} }));
vi.mock("../../config/logger", () => ({ logger: { warn: mocks.warn } }));
vi.mock("../../lib/prisma", () => ({ prisma: { marketplaceAsset: {
  create: mocks.assetCreate,
  update: mocks.assetUpdate,
  updateMany: mocks.assetUpdateMany,
  findMany: mocks.assetFindMany,
  deleteMany: mocks.assetDeleteMany
}, marketplaceAssetModerationDecision: { count: mocks.decisionCount } } }));
vi.mock("../../lib/cloudinary", () => ({ cloudinary: { uploader: {
  upload_stream: mocks.uploadStream,
  destroy: mocks.destroy
} } }));
vi.mock("../content-moderation/sightengine.provider", () => ({
  sightengineProvider: { scan: mocks.scan },
  SightengineProviderError: class SightengineProviderError extends Error {
    constructor(public statusCode: number, public code: string) { super(code); }
  }
}));
vi.mock("../content-moderation/content-moderation.service", () => ({
  contentModerationService: { evaluate: mocks.evaluate }
}));

import { classifyVisualScores, marketplaceAssetService } from "./marketplace-asset.service";

const file = {
  mimetype: "image/jpeg",
  size: 4,
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  originalname: "photo.jpg"
} as Express.Multer.File;

const allowResult = {
  decision: "ALLOW", categories: [], ruleId: null, ruleVersion: "1",
  policyVersion: "policy-1", contentHash: "ocr-hash", domain: "MARKETPLACE", severity: "NONE"
};

describe("marketplaceAssetService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assetCreate.mockResolvedValue({ id: "asset-1" });
    mocks.decisionCount.mockResolvedValue(0);
    mocks.assetUpdate.mockImplementation(({ data, select }) => Promise.resolve({
      id: "asset-1", status: data.status, url: data.url ?? null,
      provider: "sightengine", providerRequestId: data.providerRequestId ?? null,
      scores: data.scores ?? null, createdAt: new Date(), scannedAt: data.scannedAt ?? null,
      ...(select ? {} : data)
    }));
    mocks.scan.mockResolvedValue({
      provider: "sightengine", requestId: "req-1", ocrText: "OCR privado",
      scores: { nudity: 0.01, sexual: 0.01, violence: 0.01, gore: 0.01, weapons: 0.01, drugs: 0.01, alcohol: 0.01, tobacco: 0.01, offensiveSymbols: 0.01 }
    });
    mocks.evaluate.mockReturnValue(allowResult);
    mocks.uploadStream.mockImplementation((_options, callback) => ({
      end: () => callback(null, { public_id: "marketplace/asset-1", secure_url: "https://cdn.test/asset.jpg" })
    }));
  });

  it("runs OCR through the shared policy and persists only moderation metadata", async () => {
    await marketplaceAssetService.create("user-1", file);

    expect(mocks.evaluate).toHaveBeenCalledWith("OCR privado", "MARKETPLACE");
    expect(mocks.assetUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ocrContentHash: "ocr-hash", ocrPolicyVersion: "policy-1" })
    }));
    expect(JSON.stringify(mocks.assetUpdate.mock.calls)).not.toContain("OCR privado");
  });

  it("never uploads OCR-blocked content", async () => {
    mocks.evaluate.mockReturnValue({ ...allowResult, decision: "BLOCK", categories: ["DRUGS"], ruleId: "drug-rule" });

    const result = await marketplaceAssetService.create("user-1", file);

    expect(result.status).toBe("REJECTED");
    expect(mocks.uploadStream).not.toHaveBeenCalled();
    expect(result.url).toBeNull();
  });

  it("never uploads visually high-risk content", async () => {
    mocks.scan.mockResolvedValue({
      provider: "sightengine", requestId: "req-risk", ocrText: "",
      scores: { nudity: 0.01, sexual: 0.01, violence: 0.9, gore: 0.01, weapons: 0.01, drugs: 0.01, alcohol: 0.01, tobacco: 0.01, offensiveSymbols: 0.01 }
    });

    const result = await marketplaceAssetService.create("user-1", file);
    expect(result.status).toBe("REJECTED");
    expect(mocks.uploadStream).not.toHaveBeenCalled();
  });

  it("stores ambiguous bytes with authenticated delivery and exposes no URL", async () => {
    mocks.scan.mockResolvedValue({
      provider: "sightengine", requestId: "req-review", ocrText: "",
      scores: { nudity: 0.31, sexual: 0, violence: 0, gore: 0, weapons: 0, drugs: 0, alcohol: 0, tobacco: 0, offensiveSymbols: 0 }
    });

    const result = await marketplaceAssetService.create("user-1", file);
    expect(result).toMatchObject({ status: "QUARANTINED", url: null });
    expect(result).not.toHaveProperty("cloudinaryPublicId");
    expect(mocks.uploadStream).toHaveBeenCalledWith(expect.objectContaining({ type: "authenticated" }), expect.any(Function));
    expect(mocks.assetUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cloudinaryPublicId: "marketplace/asset-1", cloudinaryType: "authenticated", url: null })
    }));
  });

  it("fails closed and leaves a quarantined record when the provider fails", async () => {
    mocks.scan.mockRejectedValue(new Error("offline"));

    await expect(marketplaceAssetService.create("user-1", file)).rejects.toMatchObject({ statusCode: 502 });
    expect(mocks.uploadStream).toHaveBeenCalledWith(expect.objectContaining({ type: "authenticated" }), expect.any(Function));
    expect(mocks.assetUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cloudinaryType: "authenticated", url: null })
    }));
  });

  it("marks deletion for durable retry when Cloudinary cleanup fails", async () => {
    mocks.assetFindMany.mockResolvedValue([{ id: "asset-1", cloudinaryPublicId: "marketplace/asset-1", cloudinaryType: "authenticated" }]);
    mocks.destroy.mockRejectedValue(new Error("offline"));
    mocks.assetUpdateMany.mockResolvedValue({ count: 1 });

    await expect(marketplaceAssetService.cleanupAssetsById(["asset-1"]))
      .resolves.toEqual({ deleted: 0, pending: 1 });
    expect(mocks.assetUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deletionRequestedAt: expect.any(Date), deletionAttempts: { increment: 1 } })
    }));
  });

  it("destroys and removes unattached resources", async () => {
    mocks.assetFindMany.mockResolvedValue([{ id: "asset-1", cloudinaryPublicId: "marketplace/asset-1", cloudinaryType: "upload" }]);
    mocks.destroy.mockResolvedValue({ result: "ok" });
    mocks.assetDeleteMany.mockResolvedValue({ count: 1 });

    await expect(marketplaceAssetService.cleanupAssetsById(["asset-1"]))
      .resolves.toEqual({ deleted: 1, pending: 0 });
    expect(mocks.destroy).toHaveBeenCalledWith("marketplace/asset-1", { resource_type: "image", type: "upload", invalidate: true });
    expect(mocks.assetUpdateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ postId: null, status: { in: ["APPROVED", "QUARANTINED", "REJECTED"] } }),
      data: expect.objectContaining({ status: "DELETE_PENDING", url: null })
    }));
    expect(mocks.assetDeleteMany).toHaveBeenCalledWith({ where: { id: "asset-1", postId: null, status: "DELETE_PENDING" } });
  });

  it("selects old or retry-marked unattached assets for orphan cleanup", async () => {
    mocks.assetFindMany
      .mockResolvedValueOnce([{ id: "asset-1" }])
      .mockResolvedValueOnce([{ id: "asset-1", cloudinaryPublicId: null, cloudinaryType: null }]);
    mocks.assetDeleteMany.mockResolvedValue({ count: 1 });
    const cutoff = new Date("2026-01-01T00:00:00.000Z");

    await marketplaceAssetService.cleanupOrphanAssets(cutoff);
    expect(mocks.assetFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { postId: null, OR: [
        { status: "DELETE_PENDING", deletionRequestedAt: { not: null } },
        { status: "QUARANTINED", createdAt: { lt: expect.any(Date) } },
        { status: { in: ["APPROVED", "REJECTED"] }, createdAt: { lt: cutoff } }
      ] }
    }));
  });

  it("uses each category's exact review and block boundaries", () => {
    const thresholds = {
      nudity: [0.31, 0.71], sexual: [0.32, 0.72], violence: [0.33, 0.73], gore: [0.34, 0.74],
      weapons: [0.35, 0.75], drugs: [0.36, 0.76], alcohol: [0.37, 0.77], tobacco: [0.38, 0.78],
      offensiveSymbols: [0.39, 0.79]
    } as const;
    const clean = { nudity: 0, sexual: 0, violence: 0, gore: 0, weapons: 0, drugs: 0, alcohol: 0, tobacco: 0, offensiveSymbols: 0 };

    for (const [category, [review, block]] of Object.entries(thresholds)) {
      expect(classifyVisualScores({ ...clean, [category]: review })).toBe("QUARANTINED");
      expect(classifyVisualScores({ ...clean, [category]: block })).toBe("REJECTED");
    }
    expect(classifyVisualScores(clean)).toBe("APPROVED");
  });
});
