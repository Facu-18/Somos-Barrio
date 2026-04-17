import { Request, Response } from "express";

export const uploadController = {
  uploadImage(req: Request, res: Response): void {
    const url = (req as Request & { cloudinaryUrl: string }).cloudinaryUrl;
    const publicId = (req as Request & { cloudinaryPublicId: string }).cloudinaryPublicId;
    res.status(201).json({ url, publicId });
  },
};
