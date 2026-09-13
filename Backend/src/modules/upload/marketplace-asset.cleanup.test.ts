import { beforeEach, describe, expect, it, vi } from "vitest";

const { cleanupOrphanAssets } = vi.hoisted(() => ({ cleanupOrphanAssets: vi.fn() }));
vi.mock("../../config/env", () => ({ env: {
  MARKETPLACE_ASSET_ORPHAN_TTL_MS: 60_000,
  MARKETPLACE_ASSET_CLEANUP_INTERVAL_MS: 5_000
} }));
vi.mock("../../config/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("./marketplace-asset.service", () => ({ marketplaceAssetService: { cleanupOrphanAssets } }));

import { processMarketplaceAssetCleanup, startMarketplaceAssetCleanup, stopMarketplaceAssetCleanup } from "./marketplace-asset.cleanup";

describe("marketplace asset cleanup lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    cleanupOrphanAssets.mockResolvedValue({ deleted: 0, pending: 0 });
  });

  it("uses the configured orphan TTL", async () => {
    vi.setSystemTime(new Date("2026-09-12T12:00:00.000Z"));
    await processMarketplaceAssetCleanup();
    expect(cleanupOrphanAssets).toHaveBeenCalledWith(new Date("2026-09-12T11:59:00.000Z"));
  });

  it("starts once and stops without leaving an interval", async () => {
    startMarketplaceAssetCleanup();
    startMarketplaceAssetCleanup();
    await vi.runOnlyPendingTimersAsync();
    await stopMarketplaceAssetCleanup();
    expect(cleanupOrphanAssets).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
