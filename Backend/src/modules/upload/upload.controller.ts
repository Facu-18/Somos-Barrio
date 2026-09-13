import { Request, Response } from "express";
import { MarketplaceAssetStatus } from "@prisma/client";
import { marketplaceAssetService } from "./marketplace-asset.service";

export const uploadController = {
  uploadImage(req: Request, res: Response): void {
    const url = (req as Request & { cloudinaryUrl: string }).cloudinaryUrl;
    const publicId = (req as Request & { cloudinaryPublicId: string }).cloudinaryPublicId;
    res.status(201).json({ success: true, data: { url, publicId } });
  },

  async uploadMarketplaceImage(req: Request, res: Response): Promise<void> {
    const asset = await marketplaceAssetService.create(req.user!.id, req.file!);
    if (asset.status === MarketplaceAssetStatus.REJECTED) {
      res.status(422).json({
        success: false,
        message: "La imagen no cumple la política de contenido.",
        details: { assetId: asset.id, status: asset.status }
      });
      return;
    }
    res.status(asset.status === MarketplaceAssetStatus.APPROVED ? 201 : 202).json({ success: true, data: asset });
  }
};
