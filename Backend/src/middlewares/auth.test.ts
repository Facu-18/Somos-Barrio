import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null)
  }
}));

vi.mock("../config/env", () => ({
  env: {
    JWT_SECRET: "test-secret-that-is-long-enough-32chars",
    NODE_ENV: "test"
  }
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { requireAuth, requireRole } from "./auth";
import { redis } from "../lib/redis";

const SECRET = "test-secret-that-is-long-enough-32chars";

function makeToken(payload: object, secret = SECRET): string {
  return jwt.sign(payload, secret, { subject: "user-001", expiresIn: "1h" });
}

function mockReqWithToken(token?: string): Partial<Request> {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cookies: {}
  };
}

describe("requireAuth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("llama next(ApiError 401) si no hay token", async () => {
    const req = mockReqWithToken();
    const next = vi.fn();

    await requireAuth(req as Request, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it("llama next(ApiError 401) si el token es inválido", async () => {
    const req = mockReqWithToken("token.invalido.xxx");
    const next = vi.fn();

    await requireAuth(req as Request, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it("llama next(ApiError 401) si el token está en blacklist", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce("1");
    const token = makeToken({ role: "VECINO", jti: "jti-blacklisted" });
    const req = mockReqWithToken(token);
    const next = vi.fn();

    await requireAuth(req as Request, {} as Response, next as NextFunction);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it("setea req.user y llama next() con token válido no blacklisted", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    const token = makeToken({ role: "ADMIN", jti: "jti-valid-001" });
    const req = mockReqWithToken(token) as Request;
    const next = vi.fn();

    await requireAuth(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(req.user?.id).toBe("user-001");
    expect(req.user?.role).toBe("ADMIN");
    expect(req.user?.jti).toBe("jti-valid-001");
  });

  it("permite la solicitud (fail-open) si Redis lanza un error", async () => {
    vi.mocked(redis.get).mockRejectedValueOnce(new Error("Redis caído"));
    const token = makeToken({ role: "VECINO", jti: "jti-redis-down" });
    const req = mockReqWithToken(token) as Request;
    const next = vi.fn();

    await requireAuth(req, {} as Response, next as NextFunction);

    // Fail-open: la solicitud debe pasar igual
    expect(next).toHaveBeenCalledWith();
    expect(req.user?.id).toBe("user-001");
  });
});

describe("requireRole", () => {
  it("llama next(ApiError 401) si req.user no está seteado", () => {
    const req = { headers: {}, cookies: {} } as Request;
    const next = vi.fn();

    requireRole("ADMIN")(req, {} as Response, next as NextFunction);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it("llama next(ApiError 403) si el rol no está permitido", () => {
    const req = { user: { id: "1", role: "VECINO", jti: "x", tokenExp: 0 } } as any;
    const next = vi.fn();

    requireRole("ADMIN")(req, {} as Response, next as NextFunction);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });

  it("llama next() si el rol está en la lista permitida", () => {
    const req = { user: { id: "1", role: "EDITOR", jti: "x", tokenExp: 0 } } as any;
    const next = vi.fn();

    requireRole("EDITOR", "ADMIN")(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });
});
