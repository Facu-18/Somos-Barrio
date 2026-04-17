import { Request, Response } from "express";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { authService } from "./auth.service";

const COOKIE_NAME = "refresh_token";
const COOKIE_MAX_AGE = env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/"
  });
}

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const { user, accessToken, refreshToken } = await authService.register(req.body);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ success: true, data: { user, accessToken } });
  },

  async login(req: Request, res: Response): Promise<void> {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    setRefreshCookie(res, refreshToken);
    res.json({ success: true, data: { user, accessToken } });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const raw: string | undefined = req.cookies[COOKIE_NAME];
    if (!raw) throw new ApiError(401, "No hay refresh token");

    const { user, accessToken, refreshToken } = await authService.refresh(raw);
    setRefreshCookie(res, refreshToken);
    res.json({ success: true, data: { user, accessToken } });
  },

  async logout(req: Request, res: Response): Promise<void> {
    const raw: string | undefined = req.cookies[COOKIE_NAME];
    await authService.logout(req.user!.jti, req.user!.tokenExp, raw);
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(204).send();
  },

  me(req: Request, res: Response): void {
    res.json({ success: true, data: req.user });
  }
};
