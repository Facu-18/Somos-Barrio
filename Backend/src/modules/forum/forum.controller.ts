import { Request, Response } from "express";
import { forumService } from "./forum.service";

export const forumController = {
  async listSubforums(req: Request, res: Response): Promise<void> {
    const subforums = await forumService.listSubforums(req.params.barrioSlug);
    res.json({ success: true, data: subforums });
  },

  async listThreads(req: Request, res: Response): Promise<void> {
    const result = await forumService.listThreads(
      req.params.barrioSlug,
      req.params.subforumSlug,
      req.query as any
    );
    res.json({ success: true, data: result });
  },

  async getThread(req: Request, res: Response): Promise<void> {
    const thread = await forumService.getThread(
      req.params.barrioSlug,
      req.params.subforumSlug,
      req.params.threadId
    );
    res.json({ success: true, data: thread });
  },

  async createThread(req: Request, res: Response): Promise<void> {
    const thread = await forumService.createThread(
      req.params.barrioSlug,
      req.params.subforumSlug,
      req.user!.id,
      req.body
    );
    res.status(201).json({ success: true, data: thread });
  },

  async createReply(req: Request, res: Response): Promise<void> {
    const reply = await forumService.createReply(
      req.params.barrioSlug,
      req.params.subforumSlug,
      req.params.threadId,
      req.user!.id,
      req.body
    );
    res.status(201).json({ success: true, data: reply });
  },

  async voteThread(req: Request, res: Response): Promise<void> {
    const result = await forumService.voteThread(
      req.params.barrioSlug,
      req.params.subforumSlug,
      req.params.threadId,
      req.user!.id,
      req.body.value
    );
    res.json({ success: true, data: result });
  },

  async voteReply(req: Request, res: Response): Promise<void> {
    const result = await forumService.voteReply(
      req.params.barrioSlug,
      req.params.subforumSlug,
      req.params.threadId,
      req.params.replyId,
      req.user!.id,
      req.body.value
    );
    res.json({ success: true, data: result });
  },

  async deleteThread(req: Request, res: Response): Promise<void> {
    await forumService.deleteThread(
      req.params.barrioSlug,
      req.params.subforumSlug,
      req.params.threadId,
      req.user!.id,
      req.user!.role
    );
    res.status(204).send();
  }
};
