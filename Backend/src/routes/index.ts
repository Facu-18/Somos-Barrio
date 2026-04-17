import { Router } from "express";
import { healthRouter }      from "../modules/health/health.routes";
import { authRouter }        from "../modules/auth/auth.routes";
import { barriosRouter }     from "../modules/barrios/barrios.routes";
import { newsRouter }        from "../modules/news/news.routes";
import { businessesRouter }  from "../modules/businesses/businesses.routes";
import { marketplaceRouter } from "../modules/marketplace/marketplace.routes";
import { forumRouter }       from "../modules/forum/forum.routes";
import { eventsRouter }      from "../modules/events/events.routes";
import { messagesRouter }    from "../modules/messages/messages.routes";
import { reviewsRouter }     from "../modules/reviews/reviews.routes";
import { adminRouter }       from "../modules/admin/admin.routes";
import { searchRouter }      from "../modules/search/search.routes";
import { uploadRouter }      from "../modules/upload/upload.routes";

const apiRouter = Router();

apiRouter.use("/upload",   uploadRouter);
apiRouter.use("/health",   healthRouter);
apiRouter.use("/auth",     authRouter);
apiRouter.use("/search",   searchRouter);
apiRouter.use("/admin",    adminRouter);
apiRouter.use("/barrios",  barriosRouter);

// Recursos anidados bajo barrio
apiRouter.use("/barrios/:barrioSlug/news",        newsRouter);
apiRouter.use("/barrios/:barrioSlug/businesses",  businessesRouter);
apiRouter.use("/barrios/:barrioSlug/marketplace", marketplaceRouter);
apiRouter.use("/barrios/:barrioSlug/forum",       forumRouter);
apiRouter.use("/barrios/:barrioSlug/events",      eventsRouter);

// Recursos de usuario
apiRouter.use("/messages", messagesRouter);

// Reseñas anidadas
apiRouter.use("/barrios/:barrioSlug/businesses/:businessSlug/reviews", reviewsRouter);

export { apiRouter };
