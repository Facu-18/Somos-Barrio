import { Request, Response } from "express";
import { authService } from "./auth.service";

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const { user, token } = await authService.register(req.body);

    res.status(201).json({
      success: true,
      data: {
        user,
        token
      }
    });
  },

  async login(req: Request, res: Response): Promise<void> {
    const { user, token } = await authService.login(req.body);

    res.json({
      success: true,
      data: {
        user,
        token
      }
    });
  },

  me(req: Request, res: Response): void {
    res.json({
      success: true,
      data: req.user
    });
  }
};
