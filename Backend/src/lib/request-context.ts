import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

type RequestContext = { requestId: string };

const storage = new AsyncLocalStorage<RequestContext>();

// Solo se acepta un id entrante opaco: evita inyectar datos personales o saltos de línea en los logs.
const VALID_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

export const REQUEST_ID_HEADER = "x-request-id";

export function resolveRequestId(incoming: unknown) {
  return typeof incoming === "string" && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}

export function getRequestId() {
  return storage.getStore()?.requestId;
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
  (req as Request & { id?: string }).id = requestId;
  res.setHeader("X-Request-Id", requestId);
  storage.run({ requestId }, next);
}

export function runWithRequestContext<T>(requestId: string, fn: () => T) {
  return storage.run({ requestId }, fn);
}
