import { Writable } from "stream";
import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { createLogger } from "./logger";

const captureProductionLog = (payload: object): Record<string, unknown> => {
  const logs: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      logs.push(chunk.toString());
      callback();
    }
  });

  createLogger("production", stream).info(payload, "Test log");
  return JSON.parse(logs[0]) as Record<string, unknown>;
};

describe("production logger", () => {
  it("redacts sensitive fields recursively using the application factory", () => {
    const output = captureProductionLog({
      password: "top-level-password",
      req: {
        headers: { authorization: "Bearer secret-token", cookie: "session=123" },
        body: { password: "request-password", content: "private prompt" }
      },
      response: { headers: { "set-cookie": "refreshToken=secret" } },
      nested: {
        deeper: {
          passwordConfirm: "password",
          refresh_token: "refresh",
          customApiKey: "api-key",
          providerSecret: "provider-secret",
          SIGHTENGINE_API_USER: "provider-user",
          CLOUDINARY_CLOUD_NAME: "cloud-name",
          DATABASE_URL: "postgresql://user:password@host/db"
        }
      }
    });

    const serialized = JSON.stringify(output);
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("session=123");
    expect(serialized).not.toContain("private prompt");
    expect(serialized).not.toContain("provider-user");
    expect(serialized).not.toContain("cloud-name");
    expect(serialized).not.toContain("postgresql://");
    expect(serialized.match(/\[Redacted\]/g)?.length).toBeGreaterThanOrEqual(10);
    expect((output.req as Record<string, unknown>).body).toBeUndefined();
    expect(output.msg).toBe("Test log");
  });

  it("redacts sensitive fields nested in arrays", () => {
    const output = captureProductionLog({ values: [{ token: "one" }, { api_secret: "two" }] });

    expect(JSON.stringify(output)).not.toMatch(/one|two/);
  });

  it("allowlists real AxiosError fields without serializing request configuration", () => {
    const config = {
      headers: new AxiosHeaders({ Authorization: "Bearer logger-secret" }),
      data: { body: "private-body", api_secret: "provider-secret" },
      url: "https://provider.test/check?api_secret=query-secret"
    } as any;
    const response = {
      status: 429,
      statusText: "Too Many Requests",
      headers: new AxiosHeaders({ "set-cookie": "refresh=secret" }),
      config,
      data: { ocr: "private-ocr", secret: "response-secret" }
    } as any;
    const error = new AxiosError("Provider request failed", "ERR_BAD_RESPONSE", config, { body: "request-body" }, response);

    const output = captureProductionLog({ err: error });
    const serialized = JSON.stringify(output);
    expect(output.err).toMatchObject({ name: "AxiosError", code: "ERR_BAD_RESPONSE", status: 429 });
    expect(output.err).not.toHaveProperty("message");
    expect(output.err).not.toHaveProperty("stack");
    expect(serialized).not.toMatch(/logger-secret|private-body|provider-secret|query-secret|refresh=secret|private-ocr|response-secret|request-body/);
    expect(serialized).not.toMatch(/"config"|"headers"|"request"|"response"|"data"|"body"/);
  });

  it("omits dynamic error details and sanitizes direct credential strings", () => {
    const logs: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs.push(chunk.toString());
        callback();
      }
    });
    const productionLogger = createLogger("production", stream);
    const error = new Error("Bearer leaked-token api_secret=leaked-secret");
    error.stack = "Error: password=leaked-password";

    productionLogger.error({ err: error }, "Cookie: session=leaked-cookie");
    const serialized = logs[0];

    expect(serialized).not.toMatch(/leaked-token|leaked-secret|leaked-password|leaked-cookie/);
    expect(JSON.parse(serialized).msg).toBe("Cookie: [Redacted]");
  });
});
