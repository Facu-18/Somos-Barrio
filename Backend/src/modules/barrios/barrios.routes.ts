import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { barrioSlugParamSchema } from "./barrios.schema";
import { barriosController } from "./barrios.controller";

const barriosRouter = Router();

barriosRouter.get("/", asyncHandler(barriosController.list));
barriosRouter.get(
  "/:barrioSlug",
  validate({ params: barrioSlugParamSchema }),
  asyncHandler(barriosController.getBySlug)
);

export { barriosRouter };
