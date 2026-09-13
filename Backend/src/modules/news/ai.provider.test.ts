import { beforeEach, describe, it, expect, vi, Mocked } from "vitest";
import axios from "axios";
import { newsSummaryProvider } from "./ai.provider";
import { ApiError } from "../../utils/api-error";
import { logger } from "../../config/logger";

vi.mock("axios");
vi.mock("../../config/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() }
}));
const mockedAxios = axios as Mocked<typeof axios>;

describe("AI Provider", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    vi.clearAllMocks();
    mockedAxios.isAxiosError.mockImplementation((error: unknown) => (
      typeof error === "object" && error !== null && "isAxiosError" in error
    ));
  });

  it("should throw a sanitized ApiError on timeout", async () => {
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      code: "ECONNABORTED"
    });

    const result = newsSummaryProvider.summarizeNews("user-123", "Test", "Content");
    await expect(result).rejects.toThrow(ApiError);
    await expect(result).rejects.toMatchObject({
      statusCode: 504,
      message: "El proveedor de IA no respondió a tiempo."
    });
  });

  it("should throw a sanitized ApiError on 429", async () => {
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 429 }
    });

    await expect(newsSummaryProvider.summarizeNews("user-123", "Test", "Content")).rejects.toMatchObject({
      statusCode: 429,
      message: "Límite de peticiones alcanzado con el proveedor de IA."
    });
  });

  it.each([
    [400, 502],
    [500, 502],
    [undefined, 502]
  ])("maps provider status %s to %s without logging request data", async (providerStatus, expectedStatus) => {
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      code: providerStatus ? "ERR_BAD_RESPONSE" : "ECONNREFUSED",
      response: providerStatus ? {
        status: providerStatus,
        headers: { "x-request-id": "request-123" },
        data: { prompt: "private prompt" }
      } : undefined,
      config: {
        headers: { Authorization: "Bearer provider-key" },
        data: { messages: ["private prompt"] }
      }
    });

    await expect(newsSummaryProvider.summarizeNews(`user-${providerStatus}`, "Test", "Content")).rejects.toMatchObject({
      statusCode: expectedStatus,
      message: "El proveedor de IA no pudo completar la solicitud."
    });

    expect(logger.warn).toHaveBeenCalledWith({
      provider: "lm-studio",
      transportCode: providerStatus ? "ERR_BAD_RESPONSE" : "ECONNREFUSED",
      transportStatus: providerStatus,
      durationMs: expect.any(Number),
      ...(providerStatus ? { requestId: "request-123" } : {})
    }, "Fallo del proveedor de IA");
    expect(JSON.stringify((logger.warn as any).mock.calls)).not.toMatch(/provider-key|private prompt|config|headers/);
  });

  it.each([
    [null, "empty"],
    [{ choices: [{ message: { content: "not-json" } }] }, "malformed"]
  ])("maps %s provider responses to 502", async (data, caseName) => {
    mockedAxios.post.mockResolvedValue({ status: 200, headers: {}, data });

    await expect(newsSummaryProvider.summarizeNews(`user-${caseName}`, "Test", "Content")).rejects.toMatchObject({
      statusCode: 502,
      message: "El proveedor de IA devolvió una respuesta inválida."
    });
  });
});
