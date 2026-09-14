import http from "node:http";
import https from "node:https";
import { afterAll } from "vitest";

/**
 * CI nunca llama servicios externos (LM Studio, Sightengine, Cloudinary, Expo push).
 * Cualquier request HTTP a un host que no sea local se redirige a un puerto cerrado —falla como
 * un proveedor caído— y queda registrada: al terminar el archivo de tests, el suite falla si hubo alguna.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const blocked: string[] = [];

type RequestFn = typeof http.request;

// Se captura antes de parchear: tanto http como https redirigen con el cliente http original.
const originalHttpRequest = http.request.bind(http) as RequestFn;

function hostnameOf(args: unknown[]): string | undefined {
  const [first, second] = args;
  if (typeof first === "string") return new URL(first).hostname;
  if (first instanceof URL) return first.hostname;
  const options = (first ?? second) as { hostname?: string; host?: string } | undefined;
  return options?.hostname ?? options?.host?.split(":")[0];
}

function guard(module: typeof http | typeof https, protocol: string) {
  const original = module.request.bind(module) as RequestFn;
  const guarded = ((...args: unknown[]) => {
    const hostname = hostnameOf(args);
    if (hostname && !LOCAL_HOSTS.has(hostname)) {
      blocked.push(`${protocol}//${hostname}`);
      // Puerto 9 (discard) cerrado: el cliente recibe ECONNREFUSED como con un proveedor caído.
      return originalHttpRequest({ hostname: "127.0.0.1", port: 9, method: "GET", path: "/" });
    }
    return (original as (...params: unknown[]) => http.ClientRequest)(...args);
  }) as RequestFn;
  module.request = guarded;
  module.get = ((...args: unknown[]) => {
    const request = (guarded as (...params: unknown[]) => http.ClientRequest)(...args);
    request.end();
    return request;
  }) as typeof http.get;
}

guard(http, "http:");
guard(https, "https:");

const originalFetch = globalThis.fetch;
if (originalFetch) {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!LOCAL_HOSTS.has(url.hostname)) {
      blocked.push(`${url.protocol}//${url.hostname}`);
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    }
    return originalFetch(input, init);
  }) as typeof fetch;
}

/** Solo para el test del propio guard: devuelve y limpia los hosts bloqueados. */
export function drainBlockedHosts() {
  return blocked.splice(0, blocked.length);
}

afterAll(() => {
  if (blocked.length) {
    const hosts = [...new Set(blocked)].join(", ");
    blocked.length = 0;
    throw new Error(`Los tests intentaron llamar servicios externos: ${hosts}. Mockeá el proveedor.`);
  }
});
