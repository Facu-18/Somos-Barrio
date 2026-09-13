import { beforeEach, describe, expect, it, vi } from "vitest";

const { post, warn } = vi.hoisted(() => ({ post: vi.fn(), warn: vi.fn() }));
vi.mock("../../config/env", () => ({ env: {
  SIGHTENGINE_ENABLED: true,
  SIGHTENGINE_API_USER: "provider-user",
  SIGHTENGINE_API_SECRET: "provider-secret",
  SIGHTENGINE_TIMEOUT_MS: 1000
} }));
vi.mock("../../config/logger", () => ({ logger: { warn } }));

import { SightengineProvider } from "./sightengine.provider";

const successResponse = {
  status: 200,
  headers: { "x-request-id": "request-123" },
  data: {
    status: "success",
    request: { id: "documented-request-123" },
    nudity: {
      sexual_activity: 0.1,
      sexual_display: 0.2,
      erotica: 0.3,
      very_suggestive: 0.4,
      suggestive: 0.5,
      mildly_suggestive: 0.6,
      none: 0.4
    },
    weapon: { classes: { firearm: 0.4, firearm_gesture: 0.01, firearm_toy: 0.02, knife: 0.03 } },
    recreational_drug: { prob: 0.1, classes: { cannabis: 0.1 } },
    medical: { prob: 0.08, classes: { pills: 0.08 } },
    alcohol: { prob: 0.2 },
    tobacco: { prob: 0.15 },
    violence: { prob: 0.12 },
    offensive: {
      nazi: 0.01,
      asian_swastika: 0.02,
      confederate: 0.03,
      supremacist: 0.04,
      terrorist: 0.05,
      middle_finger: 0.25
    },
    gore: { prob: 0.05 },
    text: { content: "texto OCR" }
  }
};

describe("SightengineProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps required visual categories and OCR", async () => {
    post.mockResolvedValue(successResponse);
    const provider = new SightengineProvider({ post } as any);

    await expect(provider.scan(Buffer.from("jpeg"), "image/jpeg", "photo.jpg")).resolves.toEqual({
      provider: "sightengine",
      requestId: "documented-request-123",
      scores: {
        nudity: 0.6, sexual: 0.3, violence: 0.12, gore: 0.05, weapons: 0.4,
        drugs: 0.1, alcohol: 0.2, tobacco: 0.15, offensiveSymbols: 0.25
      },
      ocrText: "texto OCR"
    });
    const submitted = post.mock.calls[0][1] as FormData;
    expect(submitted.get("models")).toBe("nudity-2.1,gore-2.0,weapon,alcohol,recreational_drug,medical,offensive-2.0,tobacco,violence,ocr");
  });

  it("keeps nudity, sexual, violence and gore signals independent", async () => {
    post.mockResolvedValue({
      ...successResponse,
      data: {
        ...successResponse.data,
        nudity: {
          ...successResponse.data.nudity,
          sexual_activity: 0.91,
          sexual_display: 0.02,
          erotica: 0.03,
          very_suggestive: 0.04,
          suggestive: 0.05,
          mildly_suggestive: 0.06
        },
        violence: { prob: 0.07 },
        gore: { prob: 0.88 }
      }
    });
    const provider = new SightengineProvider({ post } as any);

    const result = await provider.scan(Buffer.from("jpeg"), "image/jpeg", "photo.jpg");
    expect(result.scores).toMatchObject({ sexual: 0.91, nudity: 0.06, violence: 0.07, gore: 0.88 });
  });

  it.each([
    [{ ...successResponse, data: { status: "failure" } }, 502, "PROVIDER_INVALID_RESPONSE"],
    [new Error("network"), 502, "PROVIDER_UNAVAILABLE"]
  ])("fails closed without logging provider bodies", async (providerResult, statusCode, code) => {
    if (providerResult instanceof Error) post.mockRejectedValue(providerResult);
    else post.mockResolvedValue(providerResult);
    const provider = new SightengineProvider({ post } as any);

    await expect(provider.scan(Buffer.from("secret-image-bytes"), "image/jpeg", "photo.jpg"))
      .rejects.toMatchObject({ statusCode, code });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-image-bytes");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("provider-secret");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("failure");
  });

  it("maps provider timeouts to 504", async () => {
    post.mockRejectedValue({ isAxiosError: true, code: "ECONNABORTED" });
    const provider = new SightengineProvider({ post } as any);
    await expect(provider.scan(Buffer.from("x"), "image/png", "photo.png"))
      .rejects.toMatchObject({ statusCode: 504, code: "PROVIDER_TIMEOUT" });
  });

  it("maps upstream rate limiting to a stable sanitized 429", async () => {
    post.mockRejectedValue({
      isAxiosError: true,
      code: "ERR_BAD_RESPONSE",
      response: { status: 429, headers: { "x-request-id": "rate-request" }, data: { secret: "never-log" } }
    });
    const provider = new SightengineProvider({ post } as any);
    await expect(provider.scan(Buffer.from("x"), "image/png", "photo.png"))
      .rejects.toMatchObject({ statusCode: 429, code: "PROVIDER_RATE_LIMITED", requestId: "rate-request" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("never-log");
  });
});
