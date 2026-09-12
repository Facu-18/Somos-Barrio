import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("axios", () => ({ default: { get } }));
vi.mock("../../config/env", () => ({
  env: { SIGHTENGINE_API_USER: "user", SIGHTENGINE_API_SECRET: "secret" }
}));
vi.mock("../../config/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { extractMarketplaceImageText } from "./marketplace.service";

describe("marketplace image OCR", () => {
  beforeEach(() => get.mockReset());

  it("returns OCR text from every image", async () => {
    get
      .mockResolvedValueOnce({ data: { status: "success", text: { content: "texto uno" } } })
      .mockResolvedValueOnce({ data: { status: "success", text: { content: "texto dos" } } });

    await expect(extractMarketplaceImageText(["https://img/1", "https://img/2"]))
      .resolves.toEqual({ text: "texto uno\ntexto dos", available: true });
  });

  it("fails closed when OCR cannot inspect an image", async () => {
    get.mockRejectedValueOnce(new Error("provider unavailable"));

    await expect(extractMarketplaceImageText(["https://img/1"]))
      .resolves.toEqual({ text: "", available: false });
  });
});
