import { Request, Response } from "express";
import { moderationService } from "./moderation.service";

export const moderationController = {
  async getMarketplaceQueue(req: Request, res: Response) {
    const queue = await moderationService.getMarketplaceQueue(req.user!.id, {
      status: req.query.status as any,
      barrioSlug: req.query.barrioSlug as string | undefined,
      page: req.query.page as unknown as number,
      limit: req.query.limit as unknown as number
    });
    res.json({ success: true, data: queue });
  },

  async moderateMarketplacePost(req: Request, res: Response) {
    const updatedPost = await moderationService.moderateMarketplacePost(
      req.user!.id,
      req.params.postId,
      req.body
    );
    res.json({ success: true, data: updatedPost });
  }
};
