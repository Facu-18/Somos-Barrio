import { Request, Response } from "express";
import { adminService } from "./admin.service";

export const adminController = {
  // ── Barrios ────────────────────────────────────────────────────────────────
  async createBarrio(req: Request, res: Response): Promise<void> {
    const barrio = await adminService.createBarrio(req.body);
    res.status(201).json({ success: true, data: barrio });
  },

  async updateBarrio(req: Request, res: Response): Promise<void> {
    const barrio = await adminService.updateBarrio(req.params.slug, req.body);
    res.json({ success: true, data: barrio });
  },

  async deleteBarrio(req: Request, res: Response): Promise<void> {
    await adminService.deleteBarrio(req.params.slug);
    res.status(204).send();
  },

  // ── Negocios ───────────────────────────────────────────────────────────────
  async verifyBusiness(req: Request, res: Response): Promise<void> {
    const business = await adminService.verifyBusiness(req.params.businessId, req.body.verified);
    res.json({ success: true, data: business });
  },

  // ── Noticias / moderación ──────────────────────────────────────────────────
  async listNews(req: Request, res: Response): Promise<void> {
    const result = await adminService.listNews(req.query as any);
    res.json({ success: true, data: result });
  },

  // ── Stats ──────────────────────────────────────────────────────────────────
  async stats(_req: Request, res: Response): Promise<void> {
    const data = await adminService.stats();
    res.json({ success: true, data });
  }
};
