import { Request, Response } from "express";
import { eventsService } from "./events.service";

export const eventsController = {
  async list(req: Request, res: Response): Promise<void> {
    const result = await eventsService.list(req.params.barrioSlug, req.query as any);
    res.json({ success: true, data: result });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const event = await eventsService.getById(req.params.barrioSlug, req.params.eventId);
    res.json({ success: true, data: event });
  },

  async create(req: Request, res: Response): Promise<void> {
    const event = await eventsService.create(req.params.barrioSlug, req.user!.id, req.body);
    res.status(201).json({ success: true, data: event });
  },

  async update(req: Request, res: Response): Promise<void> {
    const event = await eventsService.update(
      req.params.barrioSlug,
      req.params.eventId,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json({ success: true, data: event });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await eventsService.remove(req.params.barrioSlug, req.params.eventId, req.user!.id, req.user!.role);
    res.status(204).send();
  },

  async rsvp(req: Request, res: Response): Promise<void> {
    const rsvp = await eventsService.rsvp(
      req.params.barrioSlug,
      req.params.eventId,
      req.user!.id,
      req.body.status
    );
    res.json({ success: true, data: rsvp });
  }
};
