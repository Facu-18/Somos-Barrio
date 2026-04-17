import { Request, Response } from "express";
import { messagesService } from "./messages.service";

export const messagesController = {
  async list(req: Request, res: Response): Promise<void> {
    const result = await messagesService.list(req.user!.id, req.query as any);
    res.json({ success: true, data: result });
  },

  async send(req: Request, res: Response): Promise<void> {
    const message = await messagesService.send(req.user!.id, req.body);
    res.status(201).json({ success: true, data: message });
  },

  async markRead(req: Request, res: Response): Promise<void> {
    const message = await messagesService.markRead(req.params.messageId, req.user!.id);
    res.json({ success: true, data: message });
  }
};
