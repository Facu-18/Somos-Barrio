import { describe, expect, it, vi } from "vitest";

// Importar las rutas instancia los rate limiters: se evita tocar Redis y proveedores.
vi.mock("../lib/redis", () => ({ redis: { call: vi.fn(), get: vi.fn(), set: vi.fn(), eval: vi.fn(), exists: vi.fn() } }));
vi.mock("rate-limit-redis", () => ({
  RedisStore: class {
    async increment() { return { totalHits: 1, resetTime: undefined }; }
    async decrement() {}
    async resetKey() {}
  }
}));

import type { Router } from "express";
import { routeMounts } from "../routes";
import { openapiSpec } from "./openapi";
import * as rateLimiters from "../middlewares/rate-limit";

// Middlewares de rate limit por identidad (no por nombre de función, que el paquete no garantiza).
const limiterHandlers = new Set<unknown>(
  Object.entries(rateLimiters).filter(([name]) => name.endsWith("RateLimiter")).map(([, handler]) => handler)
);

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

type Layer = { route?: { path: string; methods: Record<string, boolean> } };

// Express 4: ":param" → OpenAPI "{param}", sin barra final.
const toOpenApiPath = (path: string) => path.replace(/:([A-Za-z0-9_]+)/g, "{$1}").replace(/\/+$/, "") || "/";

function expressOperations() {
  const operations = new Set<string>();
  for (const [mount, router] of routeMounts) {
    for (const layer of (router as Router & { stack: Layer[] }).stack) {
      if (!layer.route) continue;
      const path = toOpenApiPath(`${mount}${layer.route.path === "/" ? "" : layer.route.path}`);
      for (const method of Object.keys(layer.route.methods)) operations.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return operations;
}

function documentedOperations() {
  const operations = new Set<string>();
  for (const [path, item] of Object.entries(openapiSpec.paths)) {
    for (const method of METHODS) {
      if (item && (item as Record<string, unknown>)[method]) operations.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return operations;
}

describe("OpenAPI", () => {
  it("documenta todas las rutas reales de la API", () => {
    const documented = documentedOperations();
    const missing = [...expressOperations()].filter((operation) => !documented.has(operation));
    expect(missing).toEqual([]);
  });

  it("no documenta rutas que no existen", () => {
    const real = expressOperations();
    const stale = [...documentedOperations()].filter((operation) => !real.has(operation));
    expect(stale).toEqual([]);
  });

  it("toda ruta con rate limiter documenta su 429", () => {
    const limited: string[] = [];
    let limitedRoutes = 0;
    for (const [mount, router] of routeMounts) {
      for (const layer of (router as Router & { stack: (Layer & { route?: { stack: { handle: unknown }[] } })[] }).stack) {
        if (!layer.route) continue;
        const usesLimiter = layer.route.stack.some((handler) => limiterHandlers.has(handler.handle));
        if (!usesLimiter) continue;
        limitedRoutes += 1;
        const path = toOpenApiPath(`${mount}${layer.route.path === "/" ? "" : layer.route.path}`);
        for (const method of Object.keys(layer.route.methods)) {
          const operation = (openapiSpec.paths[path] as Record<string, { responses?: Record<string, unknown> }> | undefined)?.[method];
          if (!operation?.responses?.["429"]) limited.push(`${method.toUpperCase()} ${path}`);
        }
      }
    }
    // Evita que el test pase vacío si cambia la forma de detectar los limiters.
    expect(limitedRoutes).toBeGreaterThan(5);
    expect(limited).toEqual([]);
  });

  it("cada respuesta de error referencia el esquema común de error", () => {
    const invalid: string[] = [];
    for (const [path, item] of Object.entries(openapiSpec.paths)) {
      for (const method of METHODS) {
        const operation = (item as Record<string, { responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> }>)?.[method];
        for (const [status, response] of Object.entries(operation?.responses ?? {})) {
          if (Number(status) < 400) continue;
          const schema = JSON.stringify(response.content?.["application/json"]?.schema ?? null);
          if (!schema.includes("#/components/schemas/Error") && !schema.includes('"success"')) invalid.push(`${method.toUpperCase()} ${path} ${status}`);
        }
      }
    }
    expect(invalid).toEqual([]);
  });
});
