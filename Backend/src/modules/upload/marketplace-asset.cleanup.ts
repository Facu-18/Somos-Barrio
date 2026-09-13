import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { marketplaceAssetService } from "./marketplace-asset.service";

let timer: NodeJS.Timeout | undefined;
let processing = false;

export async function processMarketplaceAssetCleanup(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const olderThan = new Date(Date.now() - env.MARKETPLACE_ASSET_ORPHAN_TTL_MS);
    const reviewOlderThan = new Date(Date.now() - env.MARKETPLACE_ASSET_REVIEW_TTL_MS);
    const reconciliation = await marketplaceAssetService.reconcilePendingReviews();
    const cleanup = await marketplaceAssetService.cleanupOrphanAssets(olderThan, reviewOlderThan);
    if (reconciliation.completed || reconciliation.pending || cleanup.deleted || cleanup.pending) {
      logger.info({ reconciliation, cleanup }, "Mantenimiento de assets de marketplace completado");
    }
  } finally {
    processing = false;
  }
}

export function startMarketplaceAssetCleanup(): void {
  if (timer) return;
  void processMarketplaceAssetCleanup().catch((error) => logger.error({ err: error }, "Falló la limpieza de assets de marketplace"));
  timer = setInterval(() => {
    void processMarketplaceAssetCleanup().catch((error) => logger.error({ err: error }, "Falló la limpieza de assets de marketplace"));
  }, env.MARKETPLACE_ASSET_CLEANUP_INTERVAL_MS);
  timer.unref();
}

export async function stopMarketplaceAssetCleanup(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = undefined;
  while (processing) await new Promise((resolve) => setTimeout(resolve, 10));
}
