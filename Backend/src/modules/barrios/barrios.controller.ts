import { Request, Response } from "express";
import { barriosService } from "./barrios.service";

export const barriosController = {
  async list(_req: Request, res: Response): Promise<void> {
    const barrios = await barriosService.list();
    res.json({ success: true, data: barrios });
  },

  async getBySlug(req: Request, res: Response): Promise<void> {
    const barrio = await barriosService.getBySlug(req.params.barrioSlug);
    res.json({ success: true, data: barrio });
  }
};
