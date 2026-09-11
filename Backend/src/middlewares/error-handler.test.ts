import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { errorHandler } from "./error-handler";
import { logger } from "../config/logger";

vi.mock("../config/logger", () => ({
  logger: {
    error: vi.fn()
  }
}));

describe("Global Error Handler", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  it("should sanitize unknown errors to prevent logging raw objects", () => {
    const rawError = {
      message: "Something broke",
      secret: "super-secret-value",
      name: "CustomError",
      stack: "stacktrace"
    };

    Object.setPrototypeOf(rawError, Error.prototype);

    errorHandler(rawError as any, mockReq as Request, mockRes as Response, mockNext);

    expect(logger.error).toHaveBeenCalled();
    const loggerArgs = (logger.error as any).mock.calls[0][0];
    expect(loggerArgs.err.message).toBe("Something broke");
    expect(loggerArgs.err.secret).toBeUndefined();
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("should sanitize Axios errors", () => {
    const axiosError = {
      isAxiosError: true,
      message: "Request failed",
      code: "ECONNREFUSED",
      name: "AxiosError",
      stack: "stacktrace",
      response: { status: 502 },
      config: { headers: { Authorization: "Bearer token" } }
    };

    errorHandler(axiosError as any, mockReq as Request, mockRes as Response, mockNext);

    expect(logger.error).toHaveBeenCalled();
    const loggerArgs = (logger.error as any).mock.calls[0][0];
    expect(loggerArgs.err.message).toBe("Request failed");
    expect(loggerArgs.err.code).toBe("ECONNREFUSED");
    expect(loggerArgs.err.status).toBe(502);
    expect(loggerArgs.err.config).toBeUndefined();
  });
});
