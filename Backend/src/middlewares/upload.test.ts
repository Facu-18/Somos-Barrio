import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadStream } = vi.hoisted(() => ({ uploadStream: vi.fn() }));
vi.mock("../lib/cloudinary", () => ({
  cloudinary: { uploader: { upload_stream: uploadStream } }
}));

import type { NextFunction, Request, Response } from "express";
import { uploadToCloudinary } from "./upload";

describe("uploadToCloudinary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resuelve una carpeta de avatar aislada desde el usuario autenticado", async () => {
    uploadStream.mockImplementation((options, callback) => ({
      end: () => callback(null, { secure_url: "https://example.test/avatar.jpg", public_id: "somos-barrio/avatars/user-1/avatar" })
    }));
    const req = { file: { buffer: Buffer.from("image") }, user: { id: "user-1" } } as unknown as Request;
    const next = vi.fn() as NextFunction;

    await uploadToCloudinary((request) => `somos-barrio/avatars/${request.user!.id}`)(req, {} as Response, next);

    expect(uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ folder: "somos-barrio/avatars/user-1" }),
      expect.any(Function)
    );
    expect(next).toHaveBeenCalledWith();
  });
});
