import { Request, Response } from "express";
import { businessesService } from "./businesses.service";

export const businessesController = {
  async list(req: Request, res: Response): Promise<void> {
    const result = await businessesService.list(req.params.barrioSlug, req.query as any);
    res.json({ success: true, data: result });
  },

  async getBySlug(req: Request, res: Response): Promise<void> {
    const business = await businessesService.getBySlug(req.params.barrioSlug, req.params.businessSlug);
    res.json({ success: true, data: business });
  },

  async create(req: Request, res: Response): Promise<void> {
    const business = await businessesService.create(req.params.barrioSlug, req.user!.id, req.body);
    res.status(201).json({ success: true, data: business });
  },

  async update(req: Request, res: Response): Promise<void> {
    const business = await businessesService.update(
      req.params.barrioSlug,
      req.params.businessSlug,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json({ success: true, data: business });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await businessesService.remove(req.params.barrioSlug, req.params.businessSlug, req.user!.id, req.user!.role);
    res.status(204).send();
  }
};
