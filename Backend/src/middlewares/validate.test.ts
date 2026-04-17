import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { validate } from "./validate";

function mockReq(body = {}, params = {}, query = {}): Partial<Request> {
  return { body, params, query: query as any };
}

describe("validate middleware", () => {
  describe("body validation", () => {
    it("parsea y reemplaza req.body con datos válidos", () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const middleware = validate({ body: schema });
      const req = mockReq({ name: "test", age: 25, extraField: "ignored" });
      const next = vi.fn();

      middleware(req as Request, {} as Response, next as NextFunction);

      expect(req.body).toEqual({ name: "test", age: 25 });
      expect(next).toHaveBeenCalledWith();
    });

    it("lanza ZodError si el body es inválido", () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const middleware = validate({ body: schema });
      const req = mockReq({ name: "test" }); // falta age
      const next = vi.fn();

      expect(() =>
        middleware(req as Request, {} as Response, next as NextFunction)
      ).toThrow(ZodError);
    });

    it("lanza ZodError con mensaje descriptivo", () => {
      const schema = z.object({ email: z.string().email() });
      const middleware = validate({ body: schema });
      const req = mockReq({ email: "not-an-email" });

      try {
        middleware(req as Request, {} as Response, vi.fn() as NextFunction);
        expect.fail("Debería haber lanzado ZodError");
      } catch (err) {
        expect(err).toBeInstanceOf(ZodError);
        const zodErr = err as ZodError;
        expect(zodErr.issues[0].path).toContain("email");
      }
    });
  });

  describe("params validation", () => {
    it("parsea req.params correctamente", () => {
      const schema = z.object({ id: z.string().cuid() });
      const middleware = validate({ params: schema });
      const validCuid = "cmo1relw20001vfrwnrl30188";
      const req = mockReq({}, { id: validCuid }) as Request;
      const next = vi.fn();

      middleware(req, {} as Response, next as NextFunction);

      expect(req.params["id"]).toBe(validCuid);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("query validation", () => {
    it("aplica defaults de Zod en query params", () => {
      const schema = z.object({
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(10)
      });
      const middleware = validate({ query: schema });
      const req = mockReq({}, {}, {});
      const next = vi.fn();

      middleware(req as Request, {} as Response, next as NextFunction);

      expect((req.query as any).page).toBe(1);
      expect((req.query as any).limit).toBe(10);
      expect(next).toHaveBeenCalledWith();
    });

    it("coerciona strings a números en query params", () => {
      const schema = z.object({ page: z.coerce.number() });
      const middleware = validate({ query: schema });
      const req = mockReq({}, {}, { page: "3" });
      const next = vi.fn();

      middleware(req as Request, {} as Response, next as NextFunction);

      expect((req.query as any).page).toBe(3);
    });
  });

  describe("validación combinada", () => {
    it("valida body, params y query en un solo middleware", () => {
      const middleware = validate({
        body: z.object({ content: z.string() }),
        params: z.object({ id: z.string() }),
        query: z.object({ page: z.coerce.number().default(1) })
      });
      const req = mockReq({ content: "hello" }, { id: "abc" }, {});
      const next = vi.fn();

      middleware(req as Request, {} as Response, next as NextFunction);

      expect(req.body.content).toBe("hello");
      expect((req.params as any).id).toBe("abc");
      expect((req.query as any).page).toBe(1);
      expect(next).toHaveBeenCalledWith();
    });
  });
});
