import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { searchQuerySchema } from "./search.schema";
import { searchController } from "./search.controller";

const searchRouter = Router();

searchRouter.get("/", validate({ query: searchQuerySchema }), asyncHandler(searchController.search));

export { searchRouter };
