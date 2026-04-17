import { Request, Response } from "express";
import { reviewsService } from "./reviews.service";

export const reviewsController = {
  async list(req: Request, res: Response): Promise<void> {
    const result = await reviewsService.list(req.params.barrioSlug, req.params.businessSlug);
    res.json({ success: true, data: result });
  },

  async create(req: Request, res: Response): Promise<void> {
    const review = await reviewsService.create(
      req.params.barrioSlug,
      req.params.businessSlug,
      req.user!.id,
      req.body
    );
    res.status(201).json({ success: true, data: review });
  }
};
