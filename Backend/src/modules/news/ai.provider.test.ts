import { beforeEach, describe, it, expect, vi, Mocked } from "vitest";
import axios from "axios";
import { newsSummaryProvider } from "./ai.provider";
import { ApiError } from "../../utils/api-error";

vi.mock("axios");
const mockedAxios = axios as Mocked<typeof axios>;

describe("AI Provider", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
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
      message: "Timeout: El proveedor de IA no respondió a tiempo."
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
});
