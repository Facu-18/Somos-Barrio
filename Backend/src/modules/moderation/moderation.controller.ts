import { Request, Response } from "express";
import { moderationService } from "./moderation.service";
import { forumModerationService } from "./forum-moderation.service";

export const moderationController = {
  async getMarketplaceQueue(req: Request, res: Response) {
    const queue = await moderationService.getMarketplaceQueue(req.user!.id, {
      queue: req.query.queue as any,
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
  },

  async getMarketplaceAssetQueue(req: Request, res: Response) {
    const queue = await moderationService.getMarketplaceAssetQueue(req.user!.id, {
      status: req.query.status as any,
      barrioSlug: req.query.barrioSlug as string | undefined,
      page: req.query.page as unknown as number,
      limit: req.query.limit as unknown as number
    });
    res.json({ success: true, data: queue });
  },

  async getForumQueue(req: Request, res: Response) {
    const queue = await forumModerationService.getQueue(req.user!.id, req.query as any);
    res.json({ success: true, data: queue });
  },

  async getForumMetrics(req: Request, res: Response) {
    const metrics = await forumModerationService.getMetrics(req.user!.id, req.query as { barrioSlug?: string });
    res.json({ success: true, data: metrics });
  },

  async moderateForumThread(req: Request, res: Response) {
    const thread = await forumModerationService.moderate(req.user!.id, { kind: "thread", id: req.params.threadId }, req.body);
    res.json({ success: true, data: thread });
  },

  async moderateForumReply(req: Request, res: Response) {
    const reply = await forumModerationService.moderate(req.user!.id, { kind: "reply", id: req.params.replyId }, req.body);
    res.json({ success: true, data: reply });
  },

  async moderateMarketplaceAsset(req: Request, res: Response) {
    const updatedAsset = await moderationService.moderateMarketplaceAsset(
      req.user!.id,
      req.params.assetId,
      req.body
    );
    res.json({ success: true, data: updatedAsset });
  }
};
