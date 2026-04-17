import { Request, Response } from "express";
import { marketplaceService } from "./marketplace.service";

export const marketplaceController = {
  async list(req: Request, res: Response): Promise<void> {
    const result = await marketplaceService.list(req.params.barrioSlug, req.query as any);
    res.json({ success: true, data: result });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const post = await marketplaceService.getById(req.params.barrioSlug, req.params.postId);
    res.json({ success: true, data: post });
  },

  async create(req: Request, res: Response): Promise<void> {
    const post = await marketplaceService.create(req.params.barrioSlug, req.user!.id, req.body);
    res.status(201).json({ success: true, data: post });
  },

  async update(req: Request, res: Response): Promise<void> {
    const post = await marketplaceService.update(
      req.params.barrioSlug,
      req.params.postId,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json({ success: true, data: post });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await marketplaceService.remove(req.params.barrioSlug, req.params.postId, req.user!.id, req.user!.role);
    res.status(204).send();
  }
};
