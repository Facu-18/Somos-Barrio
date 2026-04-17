import { Request, Response } from "express";
import { searchService } from "./search.service";

export const searchController = {
  async search(req: Request, res: Response): Promise<void> {
    const result = await searchService.search(req.query as any);
    res.json({ success: true, data: result });
  }
};
