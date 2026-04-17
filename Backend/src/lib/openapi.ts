import type { OpenAPIV3 } from "openapi-types";

type Schema = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;

const ref = (name: string): OpenAPIV3.ReferenceObject => ({ $ref: `#/components/schemas/${name}` });

const bearerAuth: OpenAPIV3.SecuritySchemeObject = {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
};

const barrioSlugParam: OpenAPIV3.ParameterObject = {
  name: "barrioSlug",
  in: "path",
  required: true,
  schema: { type: "string", example: "palermo" },
};

// ── Reusable schemas ────────────────────────────────────────────────────────

const UserSchema = {
  type: "object",
  properties: {
    id:        { type: "string", format: "uuid" },
    email:     { type: "string", format: "email" },
    name:      { type: "string" },
    role:      { type: "string", enum: ["VECINO", "NEGOCIO", "EDITOR", "ADMIN"] },
    barrioId:  { type: "string", format: "uuid", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
} satisfies OpenAPIV3.SchemaObject;

const BarrioSchema = {
  type: "object",
  properties: {
    id:          { type: "string", format: "uuid" },
    name:        { type: "string", example: "Palermo" },
    slug:        { type: "string", example: "palermo" },
    city:        { type: "string", example: "Buenos Aires" },
    province:    { type: "string", example: "Buenos Aires" },
    description: { type: "string", nullable: true },
    imageUrl:    { type: "string", nullable: true },
    createdAt:   { type: "string", format: "date-time" },
  },
} satisfies OpenAPIV3.SchemaObject;

const NewsSchema = {
  type: "object",
  properties: {
    id:          { type: "string", format: "uuid" },
    title:       { type: "string" },
    slug:        { type: "string" },
    content:     { type: "string" },
    summary:     { type: "string", nullable: true },
    imageUrl:    { type: "string", nullable: true },
    category:    { type: "string", nullable: true },
    status:      { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
    publishedAt: { type: "string", format: "date-time", nullable: true },
    author:      ref("UserSummary"),
    barrioId:    { type: "string", format: "uuid" },
    createdAt:   { type: "string", format: "date-time" },
  },
};

const BusinessSchema = {
  type: "object",
  properties: {
    id:          { type: "string", format: "uuid" },
    name:        { type: "string" },
    slug:        { type: "string" },
    description: { type: "string", nullable: true },
    category:    { type: "string", nullable: true },
    address:     { type: "string", nullable: true },
    phone:       { type: "string", nullable: true },
    website:     { type: "string", nullable: true },
    imageUrl:    { type: "string", nullable: true },
    verified:    { type: "boolean" },
    ownerId:     { type: "string", format: "uuid" },
    barrioId:    { type: "string", format: "uuid" },
    createdAt:   { type: "string", format: "date-time" },
  },
};

const MarketplacePostSchema = {
  type: "object",
  properties: {
    id:          { type: "string", format: "uuid" },
    title:       { type: "string" },
    description: { type: "string" },
    price:       { type: "number", nullable: true },
    imageUrl:    { type: "string", nullable: true },
    condition:   { type: "string", enum: ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"], nullable: true },
    status:      { type: "string", enum: ["ACTIVE", "SOLD", "RESERVED"] },
    views:       { type: "integer" },
    author:      ref("UserSummary"),
    barrioId:    { type: "string", format: "uuid" },
    createdAt:   { type: "string", format: "date-time" },
  },
};

const ForumSubforumSchema = {
  type: "object",
  properties: {
    id:          { type: "string", format: "uuid" },
    name:        { type: "string" },
    slug:        { type: "string" },
    description: { type: "string", nullable: true },
    barrioId:    { type: "string", format: "uuid" },
    _count:      { type: "object", properties: { threads: { type: "integer" } } },
  },
};

const ForumThreadSchema = {
  type: "object",
  properties: {
    id:         { type: "string", format: "uuid" },
    title:      { type: "string" },
    content:    { type: "string" },
    isPinned:   { type: "boolean" },
    isLocked:   { type: "boolean" },
    votes:      { type: "integer" },
    author:     ref("UserSummary"),
    subforumId: { type: "string", format: "uuid" },
    createdAt:  { type: "string", format: "date-time" },
    _count:     { type: "object", properties: { replies: { type: "integer" } } },
  },
};

const EventSchema = {
  type: "object",
  properties: {
    id:          { type: "string", format: "uuid" },
    title:       { type: "string" },
    description: { type: "string", nullable: true },
    location:    { type: "string", nullable: true },
    startsAt:    { type: "string", format: "date-time" },
    endsAt:      { type: "string", format: "date-time", nullable: true },
    imageUrl:    { type: "string", nullable: true },
    organizer:   ref("UserSummary"),
    barrioId:    { type: "string", format: "uuid" },
    _count:      { type: "object", properties: { rsvps: { type: "integer" } } },
    createdAt:   { type: "string", format: "date-time" },
  },
};

const MessageSchema = {
  type: "object",
  properties: {
    id:         { type: "string", format: "uuid" },
    subject:    { type: "string" },
    body:       { type: "string" },
    readAt:     { type: "string", format: "date-time", nullable: true },
    sender:     ref("UserSummary"),
    recipient:  ref("UserSummary"),
    createdAt:  { type: "string", format: "date-time" },
  },
};

const ReviewSchema = {
  type: "object",
  properties: {
    id:         { type: "string", format: "uuid" },
    rating:     { type: "integer", minimum: 1, maximum: 5 },
    comment:    { type: "string", nullable: true },
    author:     ref("UserSummary"),
    businessId: { type: "string", format: "uuid" },
    createdAt:  { type: "string", format: "date-time" },
  },
};

const UserSummarySchema = {
  type: "object",
  properties: {
    id:   { type: "string", format: "uuid" },
    name: { type: "string" },
  },
} satisfies OpenAPIV3.SchemaObject;

const ErrorSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
} satisfies OpenAPIV3.SchemaObject;

const PaginationSchema = {
  type: "object",
  properties: {
    total:  { type: "integer" },
    page:   { type: "integer" },
    limit:  { type: "integer" },
    pages:  { type: "integer" },
  },
} satisfies OpenAPIV3.SchemaObject;

// ── Helper factories ────────────────────────────────────────────────────────

const ok = (schema: Schema): OpenAPIV3.ResponseObject => ({
  description: "OK",
  content: { "application/json": { schema } },
});

const created = (schema: Schema): OpenAPIV3.ResponseObject => ({
  description: "Created",
  content: { "application/json": { schema } },
});

const noContent: OpenAPIV3.ResponseObject = { description: "No Content" };

const unauthorized: OpenAPIV3.ResponseObject = {
  description: "Unauthorized",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
};

const forbidden: OpenAPIV3.ResponseObject = {
  description: "Forbidden",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
};

const notFound: OpenAPIV3.ResponseObject = {
  description: "Not Found",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
};

const conflict: OpenAPIV3.ResponseObject = {
  description: "Conflict",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
};

const unprocessable: OpenAPIV3.ResponseObject = {
  description: "Unprocessable Entity (validation error)",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
};

// ── Spec ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const openapiSpec = ({
  openapi: "3.0.3",
  info: {
    title: "Somos Barrio API",
    version: "1.0.0",
    description:
      "API para la revista barrial digital Somos Barrio. Multi-barrio, con roles VECINO / NEGOCIO / EDITOR / ADMIN.",
    contact: { email: "facundomoriconi19@gmail.com" },
  },
  servers: [
    { url: "http://localhost:4000/api/v1", description: "Desarrollo local" },
  ],
  components: {
    securitySchemes: { bearerAuth },
    schemas: {
      User:            UserSchema,
      UserSummary:     UserSummarySchema,
      Barrio:          BarrioSchema,
      News:            NewsSchema,
      Business:        BusinessSchema,
      MarketplacePost: MarketplacePostSchema,
      ForumSubforum:   ForumSubforumSchema,
      ForumThread:     ForumThreadSchema,
      Event:           EventSchema,
      Message:         MessageSchema,
      Review:          ReviewSchema,
      Error:           ErrorSchema,
      Pagination:      PaginationSchema,
    },
  },
  paths: {

    // ── Health ───────────────────────────────────────────────────────────
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Verificar estado del servidor",
        responses: {
          200: ok({ type: "object", properties: { status: { type: "string", example: "ok" } } }),
        },
      },
    },

    // ── Auth ─────────────────────────────────────────────────────────────
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Registrar nuevo usuario",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name"],
                properties: {
                  email:      { type: "string", format: "email" },
                  password:   { type: "string", minLength: 8, maxLength: 72 },
                  name:       { type: "string", minLength: 2, maxLength: 120 },
                  barrioSlug: { type: "string", description: "Barrio inicial del usuario (opcional)" },
                },
              },
            },
          },
        },
        responses: {
          201: created({
            type: "object",
            properties: {
              accessToken: { type: "string" },
              user:        { $ref: "#/components/schemas/User" },
            },
          }),
          409: conflict,
          422: unprocessable,
        },
      },
    },

    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Iniciar sesión",
        description: "Devuelve `accessToken` en body y `refresh_token` como httpOnly cookie.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email:    { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          200: ok({
            type: "object",
            properties: {
              accessToken: { type: "string" },
              user:        { $ref: "#/components/schemas/User" },
            },
          }),
          401: unauthorized,
          422: unprocessable,
        },
      },
    },

    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotar refresh token",
        description: "Lee el cookie `refresh_token`, emite nuevo access token y rota el cookie.",
        responses: {
          200: ok({ type: "object", properties: { accessToken: { type: "string" } } }),
          401: unauthorized,
        },
      },
    },

    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Cerrar sesión",
        description: "Blacklistea el JWT y elimina el refresh token.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: ok({ type: "object", properties: { message: { type: "string" } } }),
          401: unauthorized,
        },
      },
    },

    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Obtener usuario autenticado",
        security: [{ bearerAuth: [] }],
        responses: {
          200: ok({ $ref: "#/components/schemas/User" }),
          401: unauthorized,
        },
      },
    },

    // ── Barrios ──────────────────────────────────────────────────────────
    "/barrios": {
      get: {
        tags: ["Barrios"],
        summary: "Listar todos los barrios",
        responses: {
          200: ok({ type: "array", items: { $ref: "#/components/schemas/Barrio" } }),
        },
      },
    },

    "/barrios/{barrioSlug}": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Barrios"],
        summary: "Obtener barrio por slug",
        responses: {
          200: ok({ $ref: "#/components/schemas/Barrio" }),
          404: notFound,
        },
      },
    },

    // ── News ─────────────────────────────────────────────────────────────
    "/barrios/{barrioSlug}/news": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Noticias"],
        summary: "Listar noticias publicadas",
        parameters: [
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "page",     in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",    in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
        ],
        responses: {
          200: ok({
            type: "object",
            properties: {
              data:       { type: "array", items: { $ref: "#/components/schemas/News" } },
              pagination: { $ref: "#/components/schemas/Pagination" },
            },
          }),
        },
      },
      post: {
        tags: ["Noticias"],
        summary: "Crear noticia (EDITOR / ADMIN)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "content"],
                properties: {
                  title:    { type: "string", maxLength: 255 },
                  content:  { type: "string" },
                  summary:  { type: "string", maxLength: 500 },
                  imageUrl: { type: "string", format: "uri" },
                  category: { type: "string" },
                  status:   { type: "string", enum: ["DRAFT", "PUBLISHED"] },
                },
              },
            },
          },
        },
        responses: {
          201: created({ $ref: "#/components/schemas/News" }),
          401: unauthorized,
          403: forbidden,
          422: unprocessable,
        },
      },
    },

    "/barrios/{barrioSlug}/news/{newsSlug}": {
      parameters: [
        barrioSlugParam,
        { name: "newsSlug", in: "path", required: true, schema: { type: "string" } },
      ],
      get: {
        tags: ["Noticias"],
        summary: "Obtener noticia por slug",
        responses: {
          200: ok({ $ref: "#/components/schemas/News" }),
          404: notFound,
        },
      },
      patch: {
        tags: ["Noticias"],
        summary: "Actualizar noticia (autor o ADMIN)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title:    { type: "string" },
                  content:  { type: "string" },
                  summary:  { type: "string" },
                  imageUrl: { type: "string", format: "uri" },
                  category: { type: "string" },
                  status:   { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
                },
              },
            },
          },
        },
        responses: {
          200: ok({ $ref: "#/components/schemas/News" }),
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
      delete: {
        tags: ["Noticias"],
        summary: "Eliminar noticia (autor o ADMIN)",
        security: [{ bearerAuth: [] }],
        responses: {
          204: noContent,
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
    },

    // ── Businesses ────────────────────────────────────────────────────────
    "/barrios/{barrioSlug}/businesses": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Comercios"],
        summary: "Listar comercios del barrio",
        parameters: [
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "verified", in: "query", schema: { type: "boolean" } },
          { name: "page",     in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",    in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: ok({ type: "array", items: { $ref: "#/components/schemas/Business" } }),
        },
      },
      post: {
        tags: ["Comercios"],
        summary: "Crear comercio",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name:        { type: "string" },
                  description: { type: "string" },
                  category:    { type: "string" },
                  address:     { type: "string" },
                  phone:       { type: "string" },
                  website:     { type: "string", format: "uri" },
                  imageUrl:    { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          201: created({ $ref: "#/components/schemas/Business" }),
          401: unauthorized,
          422: unprocessable,
        },
      },
    },

    "/barrios/{barrioSlug}/businesses/{businessSlug}": {
      parameters: [
        barrioSlugParam,
        { name: "businessSlug", in: "path", required: true, schema: { type: "string" } },
      ],
      get: {
        tags: ["Comercios"],
        summary: "Obtener comercio por slug",
        responses: {
          200: ok({ $ref: "#/components/schemas/Business" }),
          404: notFound,
        },
      },
      patch: {
        tags: ["Comercios"],
        summary: "Actualizar comercio (propietario o ADMIN)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name:        { type: "string" },
                  description: { type: "string" },
                  category:    { type: "string" },
                  address:     { type: "string" },
                  phone:       { type: "string" },
                  website:     { type: "string", format: "uri" },
                  imageUrl:    { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          200: ok({ $ref: "#/components/schemas/Business" }),
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
      delete: {
        tags: ["Comercios"],
        summary: "Eliminar comercio (propietario o ADMIN)",
        security: [{ bearerAuth: [] }],
        responses: {
          204: noContent,
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
    },

    // ── Reviews ───────────────────────────────────────────────────────────
    "/barrios/{barrioSlug}/businesses/{businessSlug}/reviews": {
      parameters: [
        barrioSlugParam,
        { name: "businessSlug", in: "path", required: true, schema: { type: "string" } },
      ],
      get: {
        tags: ["Reseñas"],
        summary: "Listar reseñas de un comercio",
        responses: {
          200: ok({
            type: "object",
            properties: {
              data:          { type: "array", items: { $ref: "#/components/schemas/Review" } },
              averageRating: { type: "number" },
              total:         { type: "integer" },
            },
          }),
          404: notFound,
        },
      },
      post: {
        tags: ["Reseñas"],
        summary: "Crear reseña (una por usuario por comercio)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["rating"],
                properties: {
                  rating:  { type: "integer", minimum: 1, maximum: 5 },
                  comment: { type: "string", maxLength: 1000 },
                },
              },
            },
          },
        },
        responses: {
          201: created({ $ref: "#/components/schemas/Review" }),
          401: unauthorized,
          409: conflict,
          422: unprocessable,
        },
      },
    },

    // ── Marketplace ───────────────────────────────────────────────────────
    "/barrios/{barrioSlug}/marketplace": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Marketplace"],
        summary: "Listar publicaciones del marketplace",
        parameters: [
          { name: "condition", in: "query", schema: { type: "string", enum: ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"] } },
          { name: "status",    in: "query", schema: { type: "string", enum: ["ACTIVE", "SOLD", "RESERVED"] } },
          { name: "page",      in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",     in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: ok({ type: "array", items: { $ref: "#/components/schemas/MarketplacePost" } }),
        },
      },
      post: {
        tags: ["Marketplace"],
        summary: "Crear publicación",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "description"],
                properties: {
                  title:       { type: "string" },
                  description: { type: "string" },
                  price:       { type: "number", minimum: 0 },
                  imageUrl:    { type: "string", format: "uri" },
                  condition:   { type: "string", enum: ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"] },
                },
              },
            },
          },
        },
        responses: {
          201: created({ $ref: "#/components/schemas/MarketplacePost" }),
          401: unauthorized,
          422: unprocessable,
        },
      },
    },

    "/barrios/{barrioSlug}/marketplace/{postId}": {
      parameters: [
        barrioSlugParam,
        { name: "postId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      get: {
        tags: ["Marketplace"],
        summary: "Obtener publicación (incrementa vistas)",
        responses: {
          200: ok({ $ref: "#/components/schemas/MarketplacePost" }),
          404: notFound,
        },
      },
      patch: {
        tags: ["Marketplace"],
        summary: "Actualizar publicación (autor o ADMIN)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title:       { type: "string" },
                  description: { type: "string" },
                  price:       { type: "number", minimum: 0 },
                  imageUrl:    { type: "string", format: "uri" },
                  condition:   { type: "string", enum: ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"] },
                  status:      { type: "string", enum: ["ACTIVE", "SOLD", "RESERVED"] },
                },
              },
            },
          },
        },
        responses: {
          200: ok({ $ref: "#/components/schemas/MarketplacePost" }),
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
      delete: {
        tags: ["Marketplace"],
        summary: "Eliminar publicación (autor o ADMIN)",
        security: [{ bearerAuth: [] }],
        responses: {
          204: noContent,
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
    },

    // ── Forum ─────────────────────────────────────────────────────────────
    "/barrios/{barrioSlug}/forum": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Foro"],
        summary: "Listar subforos del barrio",
        responses: {
          200: ok({ type: "array", items: { $ref: "#/components/schemas/ForumSubforum" } }),
        },
      },
    },

    "/barrios/{barrioSlug}/forum/{subforumSlug}/threads": {
      parameters: [
        barrioSlugParam,
        { name: "subforumSlug", in: "path", required: true, schema: { type: "string" } },
      ],
      get: {
        tags: ["Foro"],
        summary: "Listar hilos del subforo",
        parameters: [
          { name: "page",  in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: ok({
            type: "object",
            properties: {
              data:       { type: "array", items: { $ref: "#/components/schemas/ForumThread" } },
              pagination: { $ref: "#/components/schemas/Pagination" },
            },
          }),
          404: notFound,
        },
      },
      post: {
        tags: ["Foro"],
        summary: "Crear hilo",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "content"],
                properties: {
                  title:   { type: "string", maxLength: 255 },
                  content: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: created({ $ref: "#/components/schemas/ForumThread" }),
          401: unauthorized,
          422: unprocessable,
        },
      },
    },

    "/barrios/{barrioSlug}/forum/{subforumSlug}/threads/{threadId}": {
      parameters: [
        barrioSlugParam,
        { name: "subforumSlug", in: "path", required: true, schema: { type: "string" } },
        { name: "threadId",     in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      get: {
        tags: ["Foro"],
        summary: "Obtener hilo con respuestas",
        responses: {
          200: ok({
            allOf: [
              { $ref: "#/components/schemas/ForumThread" },
              {
                type: "object",
                properties: {
                  replies: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id:        { type: "string", format: "uuid" },
                        content:   { type: "string" },
                        votes:     { type: "integer" },
                        author:    { $ref: "#/components/schemas/UserSummary" },
                        parentId:  { type: "string", format: "uuid", nullable: true },
                        children:  { type: "array", items: { type: "object" } },
                        createdAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            ],
          }),
          404: notFound,
        },
      },
      delete: {
        tags: ["Foro"],
        summary: "Eliminar hilo (autor o ADMIN)",
        security: [{ bearerAuth: [] }],
        responses: {
          204: noContent,
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
    },

    "/barrios/{barrioSlug}/forum/{subforumSlug}/threads/{threadId}/replies": {
      parameters: [
        barrioSlugParam,
        { name: "subforumSlug", in: "path", required: true, schema: { type: "string" } },
        { name: "threadId",     in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      post: {
        tags: ["Foro"],
        summary: "Responder hilo",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content:  { type: "string" },
                  parentId: { type: "string", format: "uuid", description: "ID de respuesta padre (para anidamiento)" },
                },
              },
            },
          },
        },
        responses: {
          201: created({
            type: "object",
            properties: {
              id:        { type: "string", format: "uuid" },
              content:   { type: "string" },
              author:    { $ref: "#/components/schemas/UserSummary" },
              threadId:  { type: "string", format: "uuid" },
              parentId:  { type: "string", format: "uuid", nullable: true },
              createdAt: { type: "string", format: "date-time" },
            },
          }),
          401: unauthorized,
        },
      },
    },

    "/barrios/{barrioSlug}/forum/{subforumSlug}/threads/{threadId}/vote": {
      parameters: [
        barrioSlugParam,
        { name: "subforumSlug", in: "path", required: true, schema: { type: "string" } },
        { name: "threadId",     in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      post: {
        tags: ["Foro"],
        summary: "Votar hilo (toggle: +1 / -1)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["value"],
                properties: {
                  value: { type: "integer", enum: [1, -1], description: "1 = upvote, -1 = downvote (voto duplicado lo elimina)" },
                },
              },
            },
          },
        },
        responses: {
          200: ok({ type: "object", properties: { votes: { type: "integer" } } }),
          401: unauthorized,
          404: notFound,
        },
      },
    },

    "/barrios/{barrioSlug}/forum/{subforumSlug}/threads/{threadId}/replies/{replyId}/vote": {
      parameters: [
        barrioSlugParam,
        { name: "subforumSlug", in: "path", required: true, schema: { type: "string" } },
        { name: "threadId",     in: "path", required: true, schema: { type: "string", format: "uuid" } },
        { name: "replyId",      in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      post: {
        tags: ["Foro"],
        summary: "Votar respuesta (toggle: +1 / -1)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["value"],
                properties: {
                  value: { type: "integer", enum: [1, -1] },
                },
              },
            },
          },
        },
        responses: {
          200: ok({ type: "object", properties: { votes: { type: "integer" } } }),
          401: unauthorized,
          404: notFound,
        },
      },
    },

    // ── Events ────────────────────────────────────────────────────────────
    "/barrios/{barrioSlug}/events": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Eventos"],
        summary: "Listar eventos del barrio",
        parameters: [
          { name: "upcoming", in: "query", schema: { type: "boolean" }, description: "Solo eventos futuros" },
          { name: "page",     in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",    in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: ok({ type: "array", items: { $ref: "#/components/schemas/Event" } }),
        },
      },
      post: {
        tags: ["Eventos"],
        summary: "Crear evento",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "startsAt"],
                properties: {
                  title:       { type: "string" },
                  description: { type: "string" },
                  location:    { type: "string" },
                  startsAt:    { type: "string", format: "date-time" },
                  endsAt:      { type: "string", format: "date-time" },
                  imageUrl:    { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          201: created({ $ref: "#/components/schemas/Event" }),
          401: unauthorized,
          422: unprocessable,
        },
      },
    },

    "/barrios/{barrioSlug}/events/{eventId}": {
      parameters: [
        barrioSlugParam,
        { name: "eventId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      get: {
        tags: ["Eventos"],
        summary: "Obtener evento por ID",
        responses: {
          200: ok({ $ref: "#/components/schemas/Event" }),
          404: notFound,
        },
      },
      patch: {
        tags: ["Eventos"],
        summary: "Actualizar evento (organizador o ADMIN)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title:       { type: "string" },
                  description: { type: "string" },
                  location:    { type: "string" },
                  startsAt:    { type: "string", format: "date-time" },
                  endsAt:      { type: "string", format: "date-time" },
                  imageUrl:    { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          200: ok({ $ref: "#/components/schemas/Event" }),
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
      delete: {
        tags: ["Eventos"],
        summary: "Eliminar evento (organizador o ADMIN)",
        security: [{ bearerAuth: [] }],
        responses: {
          204: noContent,
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
    },

    "/barrios/{barrioSlug}/events/{eventId}/rsvp": {
      parameters: [
        barrioSlugParam,
        { name: "eventId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      post: {
        tags: ["Eventos"],
        summary: "Confirmar / cancelar asistencia al evento (upsert)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string", enum: ["GOING", "INTERESTED", "NOT_GOING"] },
                },
              },
            },
          },
        },
        responses: {
          200: ok({
            type: "object",
            properties: {
              status: { type: "string", enum: ["GOING", "INTERESTED", "NOT_GOING"] },
            },
          }),
          401: unauthorized,
          404: notFound,
        },
      },
    },

    // ── Messages ──────────────────────────────────────────────────────────
    "/messages": {
      post: {
        tags: ["Mensajes"],
        summary: "Enviar mensaje a otro usuario",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["recipientId", "subject", "body"],
                properties: {
                  recipientId: { type: "string", format: "uuid" },
                  subject:     { type: "string", maxLength: 255 },
                  body:        { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: created({ $ref: "#/components/schemas/Message" }),
          401: unauthorized,
          422: unprocessable,
        },
      },
    },

    "/messages/inbox": {
      get: {
        tags: ["Mensajes"],
        summary: "Bandeja de entrada",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page",  in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: ok({
            type: "object",
            properties: {
              data:       { type: "array", items: { $ref: "#/components/schemas/Message" } },
              pagination: { $ref: "#/components/schemas/Pagination" },
            },
          }),
          401: unauthorized,
        },
      },
    },

    "/messages/sent": {
      get: {
        tags: ["Mensajes"],
        summary: "Mensajes enviados",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page",  in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: ok({
            type: "object",
            properties: {
              data:       { type: "array", items: { $ref: "#/components/schemas/Message" } },
              pagination: { $ref: "#/components/schemas/Pagination" },
            },
          }),
          401: unauthorized,
        },
      },
    },

    "/messages/{messageId}/read": {
      parameters: [
        { name: "messageId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      patch: {
        tags: ["Mensajes"],
        summary: "Marcar mensaje como leído",
        security: [{ bearerAuth: [] }],
        responses: {
          200: ok({ $ref: "#/components/schemas/Message" }),
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
    },

    // ── Search ────────────────────────────────────────────────────────────
    "/search": {
      get: {
        tags: ["Búsqueda"],
        summary: "Búsqueda global (ILIKE)",
        parameters: [
          { name: "q",          in: "query", required: true, schema: { type: "string", minLength: 2 }, description: "Texto a buscar" },
          { name: "barrioSlug", in: "query", schema: { type: "string" }, description: "Filtrar por barrio" },
          { name: "types",      in: "query", schema: { type: "string" }, description: "Módulos separados por coma: news,businesses,marketplace,forum" },
        ],
        responses: {
          200: ok({
            type: "object",
            properties: {
              news:        { type: "array", items: { $ref: "#/components/schemas/News" } },
              businesses:  { type: "array", items: { $ref: "#/components/schemas/Business" } },
              marketplace: { type: "array", items: { $ref: "#/components/schemas/MarketplacePost" } },
              forum:       { type: "array", items: { $ref: "#/components/schemas/ForumThread" } },
            },
          }),
          422: unprocessable,
        },
      },
    },

    // ── Admin ─────────────────────────────────────────────────────────────
    "/admin/stats": {
      get: {
        tags: ["Admin"],
        summary: "Estadísticas globales (solo ADMIN)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: ok({
            type: "object",
            properties: {
              users:      { type: "integer" },
              barrios:    { type: "integer" },
              news:       { type: "integer" },
              businesses: { type: "integer" },
              events:     { type: "integer" },
              posts:      { type: "integer" },
              threads:    { type: "integer" },
            },
          }),
          401: unauthorized,
          403: forbidden,
        },
      },
    },

    "/admin/news": {
      get: {
        tags: ["Admin"],
        summary: "Listar noticias con filtro de status (moderación)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] } },
          { name: "page",   in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",  in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: ok({ type: "array", items: { $ref: "#/components/schemas/News" } }),
          401: unauthorized,
          403: forbidden,
        },
      },
    },

    "/admin/barrios": {
      post: {
        tags: ["Admin"],
        summary: "Crear barrio (solo ADMIN)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "slug", "city", "province"],
                properties: {
                  name:        { type: "string" },
                  slug:        { type: "string" },
                  city:        { type: "string" },
                  province:    { type: "string" },
                  description: { type: "string" },
                  imageUrl:    { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          201: created({ $ref: "#/components/schemas/Barrio" }),
          401: unauthorized,
          403: forbidden,
          409: conflict,
          422: unprocessable,
        },
      },
    },

    "/admin/barrios/{slug}": {
      parameters: [
        { name: "slug", in: "path", required: true, schema: { type: "string" } },
      ],
      patch: {
        tags: ["Admin"],
        summary: "Actualizar barrio (solo ADMIN)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name:        { type: "string" },
                  city:        { type: "string" },
                  province:    { type: "string" },
                  description: { type: "string" },
                  imageUrl:    { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          200: ok({ $ref: "#/components/schemas/Barrio" }),
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
      delete: {
        tags: ["Admin"],
        summary: "Eliminar barrio en cascada (solo ADMIN)",
        security: [{ bearerAuth: [] }],
        responses: {
          204: noContent,
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
    },

    "/admin/businesses/{businessId}/verify": {
      parameters: [
        { name: "businessId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      patch: {
        tags: ["Admin"],
        summary: "Verificar / desverificar comercio (solo ADMIN)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["verified"],
                properties: {
                  verified: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: ok({ $ref: "#/components/schemas/Business" }),
          401: unauthorized,
          403: forbidden,
          404: notFound,
        },
      },
    },
  },
}) as unknown as OpenAPIV3.Document;
