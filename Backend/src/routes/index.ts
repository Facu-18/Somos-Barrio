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
import { notificationsRouter } from "../modules/notifications/notifications.routes";
import { moderationRouter }    from "../modules/moderation/moderation.routes";

// Montajes explícitos: el test de paridad con OpenAPI recorre esta misma lista.
export const routeMounts: [path: string, router: Router][] = [
  ["/upload",   uploadRouter],
  ["/health",   healthRouter],
  ["/auth",     authRouter],
  ["/search",   searchRouter],
  ["/admin",    adminRouter],
  ["/moderation", moderationRouter],
  ["/barrios",  barriosRouter],

  // Recursos anidados bajo barrio
  ["/barrios/:barrioSlug/news",        newsRouter],
  ["/barrios/:barrioSlug/businesses",  businessesRouter],
  ["/barrios/:barrioSlug/marketplace", marketplaceRouter],
  ["/barrios/:barrioSlug/forum",       forumRouter],
  ["/barrios/:barrioSlug/events",      eventsRouter],

  // Recursos de usuario
  ["/messages", messagesRouter],
  ["/notifications", notificationsRouter],

  // Reseñas anidadas
  ["/barrios/:barrioSlug/businesses/:businessSlug/reviews", reviewsRouter]
];

const apiRouter = Router();
for (const [path, router] of routeMounts) {
  apiRouter.use(path, router);
}

export { apiRouter };
