import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireRole } from "../../middlewares/auth";
import {
  adminBarrioSlugParamSchema,
  adminBusinessIdParamSchema,
  adminNewsQuerySchema,
  createBarrioSchema,
  updateBarrioSchema,
  verifyBusinessSchema,
  adminCreateBusinessSchema,
  adminUpdateBusinessSchema
} from "./admin.schema";
import { adminController } from "./admin.controller";

const adminRouter = Router();

// Todos los endpoints requieren autenticación y rol ADMIN
adminRouter.use(requireAuth, requireRole(UserRole.ADMIN));

// ── Stats ──────────────────────────────────────────────────────────────────
adminRouter.get("/stats", asyncHandler(adminController.stats));

// ── Barrios ────────────────────────────────────────────────────────────────
adminRouter.get(
  "/news",
  validate({ query: adminNewsQuerySchema }),
  asyncHandler(adminController.listNews)
);

adminRouter.post(
  "/barrios",
  validate({ body: createBarrioSchema }),
  asyncHandler(adminController.createBarrio)
);

adminRouter.patch(
  "/barrios/:slug",
  validate({ params: adminBarrioSlugParamSchema, body: updateBarrioSchema }),
  asyncHandler(adminController.updateBarrio)
);

adminRouter.delete(
  "/barrios/:slug",
  validate({ params: adminBarrioSlugParamSchema }),
  asyncHandler(adminController.deleteBarrio)
);

// ── Negocios ───────────────────────────────────────────────────────────────
adminRouter.post(
  "/businesses",
  validate({ body: adminCreateBusinessSchema }),
  asyncHandler(adminController.createBusiness)
);

adminRouter.patch(
  "/businesses/:businessId",
  validate({ params: adminBusinessIdParamSchema, body: adminUpdateBusinessSchema }),
  asyncHandler(adminController.updateBusiness)
);

adminRouter.delete(
  "/businesses/:businessId",
  validate({ params: adminBusinessIdParamSchema }),
  asyncHandler(adminController.deleteBusiness)
);

adminRouter.patch(
  "/businesses/:businessId/verify",
  validate({ params: adminBusinessIdParamSchema, body: verifyBusinessSchema }),
  asyncHandler(adminController.verifyBusiness)
);

export { adminRouter };
