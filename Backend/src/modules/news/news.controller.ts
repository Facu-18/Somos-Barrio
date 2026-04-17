import { Request, Response } from "express";
import { newsService } from "./news.service";

export const newsController = {
  async list(req: Request, res: Response): Promise<void> {
    const result = await newsService.list(req.params.barrioSlug, req.query as any);
    res.json({ success: true, data: result });
  },

  async getBySlug(req: Request, res: Response): Promise<void> {
    const news = await newsService.getBySlug(req.params.barrioSlug, req.params.newsSlug);
    res.json({ success: true, data: news });
  },

  async create(req: Request, res: Response): Promise<void> {
    const news = await newsService.create(req.params.barrioSlug, req.user!.id, req.body);
    res.status(201).json({ success: true, data: news });
  },

  async update(req: Request, res: Response): Promise<void> {
    const news = await newsService.update(
      req.params.barrioSlug,
      req.params.newsSlug,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json({ success: true, data: news });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await newsService.remove(req.params.barrioSlug, req.params.newsSlug, req.user!.id, req.user!.role);
    res.status(204).send();
  }
};
