import { describe, it, expect } from "vitest";
import pino from "pino";
import { Writable } from "stream";

describe("Logger Redaction", () => {
  it("should redact authorization headers and api keys", () => {
    const logs: string[] = [];
    const stream = new Writable({
      write(chunk, encoding, callback) {
        logs.push(chunk.toString());
        callback();
      }
    });

    const testLogger = pino({
      level: "info",
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
          "err.config.headers.Authorization",
          "err.config.headers.authorization",
          "password",
          "AI_API_KEY",
          "*.password",
          "*.passwordConfirm",
          "*.token",
          "*.refreshToken",
          "*.AI_API_KEY"
        ],
        censor: "[Redacted]"
      }
    }, stream);

    testLogger.info({
      req: {
        headers: {
          authorization: "Bearer secret-token",
          cookie: "session=123"
        }
      },
      err: {
        config: {
          headers: {
            Authorization: "Bearer api-key"
          }
        }
      },
      password: "my-password",
      AI_API_KEY: "sk-1234"
    }, "Test log");

    const logOutput = JSON.parse(logs[0]);
    expect(logOutput.req.headers.authorization).toBe("[Redacted]");
    expect(logOutput.req.headers.cookie).toBe("[Redacted]");
    expect(logOutput.err.config.headers.Authorization).toBe("[Redacted]");
    expect(logOutput.password).toBe("[Redacted]");
    expect(logOutput.AI_API_KEY).toBe("[Redacted]");
    expect(logOutput.msg).toBe("Test log");
  });
});
