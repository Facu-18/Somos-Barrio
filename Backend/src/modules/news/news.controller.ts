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

  async listMine(req: Request, res: Response): Promise<void> {
    const result = await newsService.listMine(req.params.barrioSlug, req.user!.id, req.query as any);
    res.json({ success: true, data: result });
  },

  async getManagedBySlug(req: Request, res: Response): Promise<void> {
    const news = await newsService.getManagedBySlug(
      req.params.barrioSlug,
      req.params.newsSlug,
      req.user!.id,
      req.user!.role
    );
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
  },

  async listPending(req: Request, res: Response): Promise<void> {
    const news = await newsService.listPending(req.params.barrioSlug, req.query as any);
    res.json({ success: true, data: news });
  },

  async approve(req: Request, res: Response): Promise<void> {
    const news = await newsService.approve(
      req.params.barrioSlug,
      req.params.newsSlug,
      req.user!.id,
      req.body
    );
    res.json({ success: true, data: news });
  },

  async reject(req: Request, res: Response): Promise<void> {
    const news = await newsService.reject(req.params.barrioSlug, req.params.newsSlug, req.body.observation);
    res.json({ success: true, data: news });
  },

  async vote(req: Request, res: Response): Promise<void> {
    const vote = await newsService.vote(req.params.barrioSlug, req.params.newsSlug, req.user!.id, req.body);
    res.json({ success: true, data: vote });
  },

  async getVotes(req: Request, res: Response): Promise<void> {
    const votes = await newsService.getVotes(req.params.barrioSlug, req.params.newsSlug, req.query as any);
    res.json({ success: true, data: votes });
  },

  async summarize(req: Request, res: Response): Promise<void> {
    const summary = await newsService.summarize(req.params.barrioSlug, req.params.newsSlug);
    res.json({ success: true, data: summary });
  },

  async improve(req: Request, res: Response): Promise<void> {
    const draft = await newsService.improve(req.params.barrioSlug, req.params.newsSlug);
    res.json({ success: true, data: draft });
  },

  async assist(req: Request, res: Response): Promise<void> {
    const draft = await newsService.assist(req.params.barrioSlug, req.body);
    res.json({ success: true, data: draft });
  }
};
