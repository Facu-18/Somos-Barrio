import type { OpenAPIV3 } from "openapi-types";

type Schema = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;

const ref = (name: string): OpenAPIV3.ReferenceObject => ({ $ref: `#/components/schemas/${name}` });
const cuid = (): OpenAPIV3.SchemaObject => ({
  type: "string",
  format: "cuid",
  pattern: "^c[a-z0-9]+$",
  example: "clx1a2b3c0000d4e5f6g7h8i9"
});
const nullableCuid = (): OpenAPIV3.SchemaObject => ({ ...cuid(), nullable: true });
const dateTime = (nullable = false): OpenAPIV3.SchemaObject => ({
  type: "string",
  format: "date-time",
  ...(nullable ? { nullable: true } : {})
});
const nullableString = (): OpenAPIV3.SchemaObject => ({ type: "string", nullable: true });
const arrayOf = (schema: Schema): OpenAPIV3.SchemaObject => ({ type: "array", items: schema });
const envelope = (schema: Schema): OpenAPIV3.SchemaObject => ({
  type: "object",
  required: ["success", "data"],
  properties: {
    success: { type: "boolean", enum: [true] },
    data: schema
  }
});
const jsonResponse = (description: string, schema: Schema): OpenAPIV3.ResponseObject => ({
  description,
  content: { "application/json": { schema } }
});
const ok = (schema: Schema): OpenAPIV3.ResponseObject => jsonResponse("OK", envelope(schema));
const created = (schema: Schema): OpenAPIV3.ResponseObject => jsonResponse("Created", envelope(schema));
const noContent: OpenAPIV3.ResponseObject = { description: "No Content" };
const errorResponse = (description: string): OpenAPIV3.ResponseObject =>
  jsonResponse(description, ref("Error"));
const badRequest = errorResponse("Bad Request");
const unauthorized = errorResponse("Unauthorized");
const forbidden = errorResponse("Forbidden");
const notFound = errorResponse("Not Found");
const conflict = errorResponse("Conflict");
const unprocessable = errorResponse("Unprocessable Entity");
const serviceUnavailable = errorResponse("Service Unavailable");
const bearerSecurity: OpenAPIV3.SecurityRequirementObject[] = [{ bearerAuth: [] }];

const jsonBody = (schema: Schema, required = true): OpenAPIV3.RequestBodyObject => ({
  required,
  content: { "application/json": { schema } }
});
const pathParam = (name: string, schema: Schema = { type: "string" }): OpenAPIV3.ParameterObject => ({
  name,
  in: "path",
  required: true,
  schema
});
const queryParam = (
  name: string,
  schema: Schema,
  required = false,
  description?: string
): OpenAPIV3.ParameterObject => ({
  name,
  in: "query",
  required,
  schema,
  ...(description ? { description } : {})
});

const barrioSlugParam = pathParam("barrioSlug", { type: "string", minLength: 1, example: "palermo" });
const businessSlugParam = pathParam("businessSlug", { type: "string", minLength: 1 });
const subforumSlugParam = pathParam("subforumSlug", { type: "string", minLength: 1 });
const newsSlugParam = pathParam("newsSlug", { type: "string", minLength: 1 });
const pageParam = queryParam("page", { type: "integer", minimum: 1, default: 1 });
const limit10Param = queryParam("limit", { type: "integer", minimum: 1, maximum: 50, default: 10 });

const userSummary: OpenAPIV3.SchemaObject = {
  type: "object",
  required: ["id"],
  description: "Las respuestas públicas usan nickname/avatarUrl y no incluyen nombre legal ni ID interno del avatar. Las vistas administrativas pueden incluir name/email.",
  properties: {
    id: cuid(), nickname: nullableString(), avatarUrl: nullableString(),
    name: { type: "string" }, email: { type: "string", format: "email" }
  }
};

const schemas: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject> = {
  Error: {
    type: "object",
    required: ["success", "message", "details"],
    properties: {
      success: { type: "boolean", enum: [false] },
      message: { type: "string" },
      details: { nullable: true }
    }
  },
  UserSummary: userSummary,
  BarrioSummary: {
    type: "object",
    required: ["id", "name", "slug"],
    properties: { id: cuid(), name: { type: "string" }, slug: { type: "string" } }
  },
  SearchBarrio: {
    type: "object",
    required: ["name", "slug"],
    properties: { name: { type: "string" }, slug: { type: "string" } }
  },
  User: {
    type: "object",
    required: ["id", "email", "name", "nickname", "bio", "role", "avatarUrl", "barrioId", "barrio", "createdAt"],
    properties: {
      id: cuid(),
      email: { type: "string", format: "email" },
      name: { type: "string" },
      nickname: nullableString(),
      bio: nullableString(),
      role: { type: "string", enum: ["VECINO", "NEGOCIO", "EDITOR", "ADMIN"] },
      avatarUrl: nullableString(),
      barrioId: nullableCuid(),
      barrio: { ...ref("BarrioSummary"), nullable: true },
      createdAt: dateTime()
    }
  },
  BrowserAuth: {
    type: "object",
    required: ["user", "accessToken"],
    properties: { user: ref("User"), accessToken: { type: "string" } }
  },
  MobileAuth: {
    type: "object",
    required: ["user", "accessToken", "refreshToken"],
    properties: {
      user: ref("User"),
      accessToken: { type: "string" },
      refreshToken: { type: "string", minLength: 64, maxLength: 256 }
    }
  },
  Barrio: {
    type: "object",
    required: ["id", "name", "slug", "city", "province", "country", "createdAt"],
    properties: {
      id: cuid(), name: { type: "string" }, slug: { type: "string" }, city: { type: "string" },
      province: { type: "string" }, country: { type: "string", minLength: 2, maxLength: 2 },
      createdAt: dateTime(), updatedAt: dateTime()
    }
  },
  News: {
    type: "object",
    required: ["id", "authorId", "barrioId", "title", "slug", "excerpt", "content", "category", "status", "publishedAt", "createdAt", "updatedAt"],
    properties: {
      id: cuid(), authorId: cuid(), barrioId: cuid(), title: { type: "string" }, slug: { type: "string" },
      excerpt: nullableString(), content: { type: "string" },
      category: { type: "string", enum: ["SEGURIDAD", "OBRAS", "EVENTOS", "MUNICIPIO", "COMUNIDAD"] },
      status: { type: "string", enum: ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "ARCHIVED"] },
      editorObservation: nullableString(),
      confirmVotes: { type: "integer", minimum: 0 }, disputeVotes: { type: "integer", minimum: 0 }, unsureVotes: { type: "integer", minimum: 0 },
      aiSummary: { ...ref("NewsAiSummary"), nullable: true },
      publishedAt: dateTime(true), createdAt: dateTime(), updatedAt: dateTime(),
      author: ref("UserSummary"), barrio: ref("BarrioSummary")
    }
  },
  NewsAiSummary: {
    type: "object",
    required: ["summary", "provider", "model", "generatedAt"],
    properties: {
      summary: { type: "string", minLength: 1, maxLength: 2000 },
      provider: { type: "string" }, model: { type: "string" }, generatedAt: dateTime()
    }
  },
  NewsEditorialDraft: {
    type: "object",
    required: ["excerpt", "content", "summary", "provider", "model", "generatedAt"],
    properties: {
      excerpt: { type: "string", maxLength: 500 }, content: { type: "string", minLength: 10 },
      summary: { type: "string", minLength: 1, maxLength: 2000 },
      provider: { type: "string" }, model: { type: "string" }, generatedAt: dateTime()
    }
  },
  NewsVote: {
    type: "object",
    required: ["id", "userId", "newsId", "value", "reason", "sourceUrl", "createdAt", "updatedAt"],
    properties: {
      id: cuid(), userId: cuid(), newsId: cuid(),
      value: { type: "string", enum: ["CONFIRM", "DISPUTE", "UNSURE"] },
      reason: { type: "string", minLength: 10, maxLength: 1000 }, sourceUrl: nullableString(),
      createdAt: dateTime(), updatedAt: dateTime(), user: ref("UserSummary")
    }
  },
  NewsListItem: {
    type: "object",
    required: ["id", "title", "slug", "excerpt", "category", "status", "publishedAt", "createdAt", "author"],
    properties: {
      id: cuid(), title: { type: "string" }, slug: { type: "string" }, excerpt: nullableString(),
      category: { type: "string", enum: ["SEGURIDAD", "OBRAS", "EVENTOS", "MUNICIPIO", "COMUNIDAD"] },
      status: { type: "string", enum: ["PUBLISHED"] },
      publishedAt: dateTime(true), createdAt: dateTime(), author: ref("UserSummary")
    }
  },
  Business: {
    type: "object",
    required: ["id", "ownerId", "barrioId", "name", "slug", "category", "address", "description", "phone", "whatsapp", "website", "instagram", "facebook", "verified", "coverImage", "photos", "latitude", "longitude", "createdAt", "updatedAt"],
    properties: {
      id: cuid(), ownerId: cuid(), barrioId: cuid(), name: { type: "string" }, slug: { type: "string" },
      category: { type: "string", enum: ["GASTRONOMIA", "SALUD", "EDUCACION", "SERVICIOS", "HOGAR", "DEPORTES", "OTROS"] },
      address: { type: "string" }, description: nullableString(), phone: nullableString(), whatsapp: nullableString(),
      website: nullableString(), instagram: nullableString(), facebook: nullableString(), verified: { type: "boolean" },
      coverImage: nullableString(), photos: arrayOf({ type: "string", format: "uri" }),
      latitude: nullableString(), longitude: nullableString(), createdAt: dateTime(), updatedAt: dateTime(),
      owner: ref("UserSummary"), barrio: ref("BarrioSummary"), reviews: arrayOf(ref("Review"))
    }
  },
  BusinessListItem: {
    type: "object",
    required: ["id", "name", "slug", "category", "address", "phone", "whatsapp", "coverImage", "verified", "createdAt", "owner"],
    properties: {
      id: cuid(), name: { type: "string" }, slug: { type: "string" },
      category: { type: "string", enum: ["GASTRONOMIA", "SALUD", "EDUCACION", "SERVICIOS", "HOGAR", "DEPORTES", "OTROS"] },
      address: { type: "string" }, phone: nullableString(), whatsapp: nullableString(), coverImage: nullableString(),
      verified: { type: "boolean" }, createdAt: dateTime(), owner: ref("UserSummary")
    }
  },
  Review: {
    type: "object",
    required: ["id", "userId", "businessId", "rating", "comment", "createdAt", "updatedAt"],
    properties: {
      id: cuid(), userId: cuid(), businessId: cuid(), rating: { type: "integer", minimum: 1, maximum: 5 },
      comment: nullableString(), createdAt: dateTime(), updatedAt: dateTime(), user: ref("UserSummary")
    }
  },
  MarketplacePost: {
    type: "object",
    required: ["id", "userId", "barrioId", "title", "description", "price", "currency", "category", "availability", "moderationStatus", "moderationReasonCode", "whatsapp", "images", "assetIds", "location", "views", "createdAt", "updatedAt"],
    properties: {
      id: cuid(), userId: cuid(), barrioId: cuid(), title: { type: "string" }, description: { type: "string" },
      price: { type: "integer", nullable: true, minimum: 0 }, currency: { type: "string", minLength: 3, maxLength: 3 },
      category: { type: "string", enum: ["ELECTRONICA", "ROPA", "MUEBLES", "DEPORTES", "SE_BUSCA", "SE_REGALA", "OTROS"] },
      availability: { type: "string", enum: ["AVAILABLE", "SOLD", "PAUSED"] },
      moderationStatus: { type: "string", enum: ["PENDING_REVIEW", "APPROVED", "REJECTED", "REMOVED"] },
      moderationReasonCode: { type: "string", nullable: true, description: "Categoría genérica; no expone la regla exacta" },
      whatsapp: { type: "string", nullable: true, pattern: "^\\+[1-9]\\d{7,14}$" },
      images: arrayOf({ type: "string", format: "uri" }), assetIds: arrayOf(cuid()), location: nullableString(), views: { type: "integer" },
      createdAt: dateTime(), updatedAt: dateTime(), user: ref("UserSummary")
    }
  },
  MarketplaceListItem: {
    type: "object",
    required: ["id", "title", "description", "price", "currency", "category", "availability", "moderationStatus", "moderationReasonCode", "images", "assetIds", "location", "views", "createdAt", "user"],
    properties: {
      id: cuid(), title: { type: "string" }, description: { type: "string" }, price: { type: "integer", nullable: true, minimum: 0 },
      currency: { type: "string" }, category: { type: "string", enum: ["ELECTRONICA", "ROPA", "MUEBLES", "DEPORTES", "SE_BUSCA", "SE_REGALA", "OTROS"] },
      availability: { type: "string", enum: ["AVAILABLE", "SOLD", "PAUSED"] },
      moderationStatus: { type: "string", enum: ["PENDING_REVIEW", "APPROVED", "REJECTED", "REMOVED"] },
      moderationReasonCode: { type: "string", nullable: true, description: "Categoría genérica; no expone la regla exacta" },
      images: arrayOf({ type: "string", format: "uri" }), assetIds: arrayOf(cuid()),
      location: nullableString(), views: { type: "integer" }, createdAt: dateTime(), user: ref("UserSummary")
    }
  },
  MarketplaceReport: {
    type: "object",
    required: ["id", "postId", "reporterId", "category", "createdAt"],
    properties: {
      id: cuid(), postId: cuid(), reporterId: cuid(), category: { type: "string", enum: ["FRAUD", "SPAM", "INAPPROPRIATE", "WEAPONS", "DRUGS", "OTHER"] },
      comment: nullableString(), createdAt: dateTime()
    }
  },
  MarketplaceAsset: {
    type: "object",
    required: ["id", "status", "url", "createdAt", "scannedAt"],
    properties: {
      id: cuid(), status: { type: "string", enum: ["QUARANTINED", "APPROVED", "REJECTED"] },
      url: { type: "string", format: "uri", nullable: true },
      createdAt: dateTime(), scannedAt: dateTime(true)
    }
  },
  ForumSubforum: {
    type: "object",
    required: ["id", "barrioId", "name", "slug", "description", "createdAt", "updatedAt", "_count"],
    properties: {
      id: cuid(), barrioId: cuid(), name: { type: "string" }, slug: { type: "string" }, description: nullableString(),
      createdAt: dateTime(), updatedAt: dateTime(),
      _count: { type: "object", required: ["threads"], properties: { threads: { type: "integer" } } }
    }
  },
  ForumReply: {
    type: "object",
    required: ["id", "threadId", "userId", "parentReplyId", "content", "upVotes", "downVotes", "createdAt", "updatedAt"],
    properties: {
      id: cuid(), threadId: cuid(), userId: cuid(), parentReplyId: nullableCuid(), content: { type: "string" },
      upVotes: { type: "integer" }, downVotes: { type: "integer" }, createdAt: dateTime(), updatedAt: dateTime(),
      user: ref("UserSummary"), childReplies: arrayOf(ref("ForumReply"))
    }
  },
  ForumThread: {
    type: "object",
    required: ["id", "userId", "barrioId", "subforumId", "title", "content", "upVotes", "downVotes", "createdAt", "updatedAt"],
    properties: {
      id: cuid(), userId: cuid(), barrioId: cuid(), subforumId: cuid(), title: { type: "string" }, content: { type: "string" },
      upVotes: { type: "integer" }, downVotes: { type: "integer" }, createdAt: dateTime(), updatedAt: dateTime(),
      user: ref("UserSummary"), replies: arrayOf(ref("ForumReply")),
      _count: { type: "object", required: ["replies"], properties: { replies: { type: "integer" } } }
    }
  },
  EventRsvp: {
    type: "object",
    required: ["id", "eventId", "userId", "status", "createdAt", "updatedAt"],
    properties: {
      id: cuid(), eventId: cuid(), userId: cuid(),
      status: { type: "string", enum: ["GOING", "INTERESTED", "NOT_GOING"] },
      createdAt: dateTime(), updatedAt: dateTime(), user: ref("UserSummary")
    }
  },
  Event: {
    type: "object",
    required: ["id", "userId", "barrioId", "title", "description", "date", "location", "createdAt", "updatedAt"],
    properties: {
      id: cuid(), userId: cuid(), barrioId: cuid(), title: { type: "string" }, description: nullableString(),
      date: dateTime(), location: { type: "string" }, createdAt: dateTime(), updatedAt: dateTime(),
      user: ref("UserSummary"), rsvps: arrayOf(ref("EventRsvp")),
      _count: { type: "object", required: ["rsvps"], properties: { rsvps: { type: "integer" } } }
    }
  },
  Message: {
    type: "object",
    required: ["id", "senderId", "receiverId", "postId", "content", "readAt", "createdAt"],
    properties: {
      id: cuid(), senderId: cuid(), receiverId: cuid(), postId: nullableCuid(), content: { type: "string" },
      readAt: dateTime(true), createdAt: dateTime(), sender: ref("UserSummary"), receiver: ref("UserSummary"),
      post: {
        type: "object", nullable: true, required: ["id", "title"],
        properties: { id: cuid(), title: { type: "string" } }
      }
    }
  },
  PaginatedNews: {
    type: "object", required: ["items", "total", "page", "limit"],
    properties: { items: arrayOf(ref("NewsListItem")), total: { type: "integer" }, page: { type: "integer" }, limit: { type: "integer" } }
  },
  PaginatedAdminNews: {
    type: "object", required: ["items", "total", "page", "limit"],
    properties: { items: arrayOf(ref("News")), total: { type: "integer" }, page: { type: "integer" }, limit: { type: "integer" } }
  },
  PaginatedNewsVotes: {
    type: "object", required: ["items", "total", "page", "limit"],
    properties: { items: arrayOf(ref("NewsVote")), total: { type: "integer" }, page: { type: "integer" }, limit: { type: "integer" } }
  },
  PaginatedBusinesses: {
    type: "object", required: ["items", "total", "page", "limit"],
    properties: { items: arrayOf(ref("BusinessListItem")), total: { type: "integer" }, page: { type: "integer" }, limit: { type: "integer" } }
  },
  PaginatedMarketplace: {
    type: "object", required: ["items", "total", "page", "limit"],
    properties: { items: arrayOf(ref("MarketplaceListItem")), total: { type: "integer" }, page: { type: "integer" }, limit: { type: "integer" } }
  },
  PaginatedThreads: {
    type: "object", required: ["items", "total", "page", "limit"],
    properties: { items: arrayOf(ref("ForumThread")), total: { type: "integer" }, page: { type: "integer" }, limit: { type: "integer" } }
  },
  PaginatedEvents: {
    type: "object", required: ["items", "total", "page", "limit"],
    properties: { items: arrayOf(ref("Event")), total: { type: "integer" }, page: { type: "integer" }, limit: { type: "integer" } }
  },
  PaginatedMessages: {
    type: "object", required: ["items", "total", "page", "limit"],
    properties: { items: arrayOf(ref("Message")), total: { type: "integer" }, page: { type: "integer" }, limit: { type: "integer" } }
  }
};

const registerBody: OpenAPIV3.SchemaObject = {
  type: "object",
  required: ["email", "password", "name"],
  properties: {
    email: { type: "string", format: "email" }, password: { type: "string", minLength: 8, maxLength: 72 },
    name: { type: "string", minLength: 2, maxLength: 120 }, barrioSlug: { type: "string", minLength: 2, maxLength: 120 }
  }
};
const loginBody: OpenAPIV3.SchemaObject = {
  type: "object", required: ["email", "password"],
  properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 8, maxLength: 72 } }
};
const refreshBody: OpenAPIV3.SchemaObject = {
  type: "object", required: ["refreshToken"],
  properties: { refreshToken: { type: "string", minLength: 64, maxLength: 256 } }
};
const mobileLogoutBody: OpenAPIV3.SchemaObject = {
  type: "object", required: ["refreshToken"],
  properties: { ...refreshBody.properties, pushToken: { type: "string", pattern: "^(ExponentPushToken|ExpoPushToken)\\[[A-Za-z0-9_-]+\\]$" } }
};
const updateProfileBody: OpenAPIV3.SchemaObject = {
  type: "object",
  description: "avatarUrl y avatarPublicId deben enviarse juntos. Para borrar el avatar, ambos deben ser strings vacíos. Solo se aceptan assets subidos por /upload/avatar bajo el prefijo exclusivo del usuario.",
  properties: {
    nickname: { type: "string", nullable: true, minLength: 2, maxLength: 30 },
    bio: { type: "string", maxLength: 160 },
    avatarUrl: { oneOf: [{ type: "string", format: "uri" }, { type: "string", enum: [""] }] },
    avatarPublicId: { type: "string", maxLength: 255, pattern: "^[A-Za-z0-9/_-]*$", description: "Vacío al borrar; en actualizaciones debe comenzar con somos-barrio/avatars/<userId>/" }
  }
};
const expoDeviceBody: OpenAPIV3.SchemaObject = {
  type: "object", required: ["token", "platform"],
  properties: {
    token: { type: "string", pattern: "^(ExponentPushToken|ExpoPushToken)\\[[A-Za-z0-9_-]+\\]$" },
    platform: { type: "string", enum: ["android", "ios"] }
  }
};
const expoTokenBody: OpenAPIV3.SchemaObject = {
  type: "object", required: ["token"], properties: { token: expoDeviceBody.properties!.token }
};
const newsCategory = { type: "string", enum: ["SEGURIDAD", "OBRAS", "EVENTOS", "MUNICIPIO", "COMUNIDAD"] } satisfies OpenAPIV3.SchemaObject;
const newsStatus = { type: "string", enum: ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "ARCHIVED"] } satisfies OpenAPIV3.SchemaObject;
const businessCategory = { type: "string", enum: ["GASTRONOMIA", "SALUD", "EDUCACION", "SERVICIOS", "HOGAR", "DEPORTES", "OTROS"] } satisfies OpenAPIV3.SchemaObject;
const marketplaceCategory = { type: "string", enum: ["ELECTRONICA", "ROPA", "MUEBLES", "DEPORTES", "SE_BUSCA", "SE_REGALA", "OTROS"] } satisfies OpenAPIV3.SchemaObject;
const marketplaceAvailability = { type: "string", enum: ["AVAILABLE", "SOLD", "PAUSED"] } satisfies OpenAPIV3.SchemaObject;
const moderationStatus = { type: "string", enum: ["PENDING_REVIEW", "APPROVED", "REJECTED", "REMOVED"] } satisfies OpenAPIV3.SchemaObject;
const rsvpStatus = { type: "string", enum: ["GOING", "INTERESTED", "NOT_GOING"] } satisfies OpenAPIV3.SchemaObject;

const createNewsBody: OpenAPIV3.SchemaObject = {
  type: "object", required: ["title", "slug", "content", "category"],
  properties: {
    title: { type: "string", minLength: 3, maxLength: 255 },
    slug: { type: "string", minLength: 3, maxLength: 255, pattern: "^[a-z0-9-]+$" },
    excerpt: { type: "string", maxLength: 500 }, content: { type: "string", minLength: 10 }, category: newsCategory,
    status: { type: "string", enum: ["DRAFT", "PENDING_REVIEW"], default: "DRAFT" }
  }
};
const updateNewsBody: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 3, maxLength: 255 }, excerpt: { type: "string", maxLength: 500 },
    content: { type: "string", minLength: 10 }, category: newsCategory,
    status: { type: "string", enum: ["DRAFT", "PENDING_REVIEW"] }
  }
};
const newsVoteBody: OpenAPIV3.SchemaObject = {
  type: "object", required: ["value", "reason"],
  properties: {
    value: { type: "string", enum: ["CONFIRM", "DISPUTE", "UNSURE"] },
    reason: { type: "string", minLength: 10, maxLength: 1000 },
    sourceUrl: { type: "string", format: "uri", maxLength: 500 }
  }
};
const newsAssistBody: OpenAPIV3.SchemaObject = {
  type: "object", required: ["title", "content"],
  properties: {
    title: { type: "string", minLength: 3, maxLength: 255 },
    excerpt: { type: "string", maxLength: 500 },
    content: { type: "string", minLength: 10 }
  }
};
const approveNewsBody: OpenAPIV3.SchemaObject = {
  type: "object", properties: {
    aiSummary: ref("NewsAiSummary"), excerpt: { type: "string", maxLength: 500 }, content: { type: "string", minLength: 10 }
  }
};
const rejectNewsBody: OpenAPIV3.SchemaObject = {
  type: "object", required: ["observation"], properties: { observation: { type: "string", minLength: 5, maxLength: 1000 } }
};
const createBusinessBody: OpenAPIV3.SchemaObject = {
  type: "object", required: ["name", "slug", "category", "address"],
  properties: {
    name: { type: "string", minLength: 2, maxLength: 255 },
    slug: { type: "string", minLength: 2, maxLength: 255, pattern: "^[a-z0-9-]+$" }, category: businessCategory,
    address: { type: "string", minLength: 2, maxLength: 255 }, description: { type: "string", maxLength: 1000 },
    phone: { type: "string", maxLength: 30 }, whatsapp: { type: "string", maxLength: 30 }, website: { type: "string", format: "uri" },
    instagram: { type: "string", maxLength: 60 }, facebook: { type: "string", maxLength: 60 }, coverImage: { type: "string", format: "uri" },
    photos: { type: "array", maxItems: 10, default: [], items: { type: "string", format: "uri" } },
    latitude: { type: "number" }, longitude: { type: "number" }
  }
};
const updateBusinessBody: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 2, maxLength: 255 }, category: businessCategory,
    address: { type: "string", minLength: 2, maxLength: 255 }, description: { type: "string", maxLength: 1000 },
    phone: { type: "string", maxLength: 30 }, whatsapp: { type: "string", maxLength: 30 }, website: { type: "string", format: "uri" },
    instagram: { type: "string", maxLength: 60 }, facebook: { type: "string", maxLength: 60 }, coverImage: { type: "string", format: "uri" },
    photos: { type: "array", maxItems: 10, items: { type: "string", format: "uri" } },
    latitude: { type: "number" }, longitude: { type: "number" }
  }
};
const createMarketplaceBody: OpenAPIV3.SchemaObject = {
  type: "object", additionalProperties: false, required: ["title", "description", "category", "whatsapp"],
  properties: {
    title: { type: "string", minLength: 3, maxLength: 255 }, description: { type: "string", minLength: 5, maxLength: 2000 },
    price: { type: "integer", minimum: 0 }, currency: { type: "string", minLength: 3, maxLength: 3, default: "ARS" },
    category: marketplaceCategory, assetIds: { type: "array", maxItems: 5, uniqueItems: true, default: [], items: cuid() },
    location: { type: "string", maxLength: 120 }, whatsapp: { type: "string", minLength: 8, maxLength: 30, description: "Se normaliza a E.164" }
  }
};
const updateMarketplaceBody: OpenAPIV3.SchemaObject = {
  type: "object", additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 3, maxLength: 255 }, description: { type: "string", minLength: 5, maxLength: 2000 },
    price: { type: "integer", minimum: 0 }, category: marketplaceCategory, availability: marketplaceAvailability,
    assetIds: { type: "array", maxItems: 5, uniqueItems: true, items: cuid() }, location: { type: "string", maxLength: 120 },
    whatsapp: { type: "string", minLength: 8, maxLength: 30, description: "Se normaliza a E.164" }
  }
};
const createEventBody: OpenAPIV3.SchemaObject = {
  type: "object", required: ["title", "date", "location"],
  properties: {
    title: { type: "string", minLength: 3, maxLength: 255 }, description: { type: "string", maxLength: 2000 },
    date: dateTime(), location: { type: "string", minLength: 2, maxLength: 255 }
  }
};
const updateEventBody: OpenAPIV3.SchemaObject = { ...createEventBody, required: undefined };
const createBarrioBody: OpenAPIV3.SchemaObject = {
  type: "object", required: ["name", "slug", "city", "province"],
  properties: {
    name: { type: "string", minLength: 2, maxLength: 120 },
    slug: { type: "string", minLength: 2, maxLength: 120, pattern: "^[a-z0-9-]+$" },
    city: { type: "string", minLength: 2, maxLength: 120 }, province: { type: "string", minLength: 2, maxLength: 120 },
    country: { type: "string", minLength: 2, maxLength: 2, default: "AR" }
  }
};
const updateBarrioBody: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 2, maxLength: 120 }, city: { type: "string", minLength: 2, maxLength: 120 },
    province: { type: "string", minLength: 2, maxLength: 120 }, country: { type: "string", minLength: 2, maxLength: 2 }
  }
};

export const openapiSpec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Somos Barrio API",
    version: "1.0.0",
    description: "API de Somos Barrio. Las rutas de este documento están bajo /api/v1."
  },
  servers: [{ url: "http://localhost:4000/api/v1", description: "Desarrollo local" }],
  tags: [
    { name: "Health" }, { name: "Auth" }, { name: "Upload" }, { name: "Barrios" }, { name: "Noticias" },
    { name: "Comercios" }, { name: "Reseñas" }, { name: "Marketplace" }, { name: "Foro" }, { name: "Eventos" },
    { name: "Mensajes" }, { name: "Notificaciones" }, { name: "Búsqueda" }, { name: "Admin" }
  ],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"], summary: "Estado general de la API",
        responses: {
          200: jsonResponse("OK", {
            type: "object", required: ["success", "message", "timestamp"],
            properties: { success: { type: "boolean", enum: [true] }, message: { type: "string", example: "API funcionando" }, timestamp: dateTime() }
          })
        }
      }
    },
    "/health/live": {
      get: {
        tags: ["Health"], summary: "Sonda de vida",
        responses: {
          200: jsonResponse("Alive", {
            type: "object", required: ["success", "status", "timestamp"],
            properties: { success: { type: "boolean", enum: [true] }, status: { type: "string", enum: ["alive"] }, timestamp: dateTime() }
          })
        }
      }
    },
    "/health/ready": {
      get: {
        tags: ["Health"], summary: "Sonda de disponibilidad de PostgreSQL y Redis",
        responses: {
          200: jsonResponse("Ready", {
            type: "object", required: ["success", "status", "timestamp"],
            properties: { success: { type: "boolean", enum: [true] }, status: { type: "string", enum: ["ready"] }, timestamp: dateTime() }
          }),
          503: jsonResponse("Not Ready", {
            type: "object", required: ["success", "status", "message", "timestamp"],
            properties: {
              success: { type: "boolean", enum: [false] }, status: { type: "string", enum: ["not_ready"] },
              message: { type: "string" }, timestamp: dateTime()
            }
          })
        }
      }
    },
    "/auth/register": {
      post: {
        tags: ["Auth"], summary: "Registro para navegador", description: "El refresh token se entrega solamente en la cookie httpOnly refresh_token.",
        requestBody: jsonBody(registerBody),
        responses: { 201: created(ref("BrowserAuth")), 400: badRequest, 409: conflict, 503: serviceUnavailable }
      }
    },
    "/auth/login": {
      post: {
        tags: ["Auth"], summary: "Inicio de sesión para navegador", description: "El refresh token se entrega solamente en la cookie httpOnly refresh_token.",
        requestBody: jsonBody(loginBody), responses: { 200: ok(ref("BrowserAuth")), 400: badRequest, 401: unauthorized, 503: serviceUnavailable }
      }
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"], summary: "Rotar sesión de navegador", description: "Lee y rota la cookie httpOnly refresh_token. No recibe body.",
        responses: { 200: ok(ref("BrowserAuth")), 401: unauthorized, 503: serviceUnavailable }
      }
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"], summary: "Cerrar sesión de navegador", security: bearerSecurity,
        responses: { 204: noContent, 401: unauthorized, 503: serviceUnavailable }
      }
    },
    "/auth/me": {
      get: { tags: ["Auth"], summary: "Usuario autenticado", security: bearerSecurity, responses: { 200: ok(ref("User")), 401: unauthorized, 503: serviceUnavailable } },
      patch: {
        tags: ["Auth"], summary: "Actualizar perfil", security: bearerSecurity, requestBody: jsonBody(updateProfileBody),
        responses: { 200: ok(ref("User")), 400: badRequest, 401: unauthorized, 409: conflict, 503: serviceUnavailable }
      }
    },
    "/auth/mobile/register": {
      post: {
        tags: ["Auth"], summary: "Registro para cliente móvil", requestBody: jsonBody(registerBody),
        responses: { 201: created(ref("MobileAuth")), 400: badRequest, 409: conflict, 503: serviceUnavailable }
      }
    },
    "/auth/mobile/login": {
      post: {
        tags: ["Auth"], summary: "Inicio de sesión para cliente móvil", requestBody: jsonBody(loginBody),
        responses: { 200: ok(ref("MobileAuth")), 400: badRequest, 401: unauthorized, 503: serviceUnavailable }
      }
    },
    "/auth/mobile/refresh": {
      post: {
        tags: ["Auth"], summary: "Rotar sesión móvil", requestBody: jsonBody(refreshBody),
        responses: { 200: ok(ref("MobileAuth")), 400: badRequest, 401: unauthorized, 503: serviceUnavailable }
      }
    },
    "/auth/mobile/logout": {
      post: {
        tags: ["Auth"], summary: "Cerrar sesión móvil", security: [{ bearerAuth: [] }, {}], description: "Revoca el refresh token y, si se envía un access token vigente, también lo agrega a la blacklist. Si se envía pushToken, elimina solamente ese dispositivo cuando pertenece a la sesión resuelta.", requestBody: jsonBody(mobileLogoutBody),
        responses: { 204: noContent, 400: badRequest, 401: unauthorized, 503: serviceUnavailable }
      }
    },
    "/notifications/register": {
      post: {
        tags: ["Notificaciones"], summary: "Registrar o reasignar un dispositivo Expo Push", security: bearerSecurity,
        requestBody: jsonBody(expoDeviceBody),
        responses: {
          200: jsonResponse("Dispositivo registrado", {
            type: "object", required: ["success", "data"],
            properties: {
              success: { type: "boolean", enum: [true] },
              data: { type: "object", required: ["message"], properties: { message: { type: "string" } } }
            }
          }),
          400: badRequest, 401: unauthorized, 503: serviceUnavailable
        }
      },
      delete: {
        tags: ["Notificaciones"], summary: "Desregistrar un dispositivo propio", security: bearerSecurity,
        requestBody: jsonBody(expoTokenBody), responses: { 204: noContent, 400: badRequest, 401: unauthorized, 503: serviceUnavailable }
      }
    },
    "/notifications/unregister": {
      post: {
        tags: ["Notificaciones"], summary: "Eliminar un registro push retenido", description: "Elimina exclusivamente el token Expo indicado. No requiere conservar credenciales de una sesión cerrada y está limitado por IP.",
        requestBody: jsonBody(expoTokenBody),
        responses: { 204: noContent, 400: badRequest, 429: { description: "Demasiadas solicitudes" }, 503: serviceUnavailable }
      }
    },
    "/upload": {
      post: {
        tags: ["Upload"], summary: "Subir una imagen", security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object", required: ["file"],
                properties: { file: { type: "string", format: "binary", description: "JPG, PNG, WebP o GIF; máximo 5 MB" } }
              }
            }
          }
        },
        responses: {
          201: created({
            type: "object", required: ["url", "publicId"],
            properties: { url: { type: "string", format: "uri" }, publicId: { type: "string" } }
          }),
          400: badRequest, 401: unauthorized, 413: errorResponse("Payload Too Large"), 422: unprocessable,
          429: errorResponse("Too Many Requests"), 502: errorResponse("Bad Gateway"), 503: serviceUnavailable, 504: errorResponse("Gateway Timeout")
        }
      }
    },
    "/upload/avatar": {
      post: {
        tags: ["Upload"], summary: "Subir un avatar propio", description: "Guarda la imagen bajo somos-barrio/avatars/<userId>/ para que solo el usuario autenticado pueda asociarla a su perfil.", security: bearerSecurity,
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary", description: "JPG, PNG, WebP o GIF; máximo 5 MB" } } } } }
        },
        responses: {
          201: created({ type: "object", required: ["url", "publicId"], properties: { url: { type: "string", format: "uri" }, publicId: { type: "string", pattern: "^somos-barrio/avatars/[^/]+/.+$" } } }),
          400: badRequest, 401: unauthorized, 413: errorResponse("Payload Too Large"), 422: unprocessable,
          429: errorResponse("Too Many Requests"), 502: errorResponse("Bad Gateway"), 503: serviceUnavailable, 504: errorResponse("Gateway Timeout")
        }
      }
    },
    "/upload/marketplace": {
      post: {
        tags: ["Upload"], summary: "Verificar y subir una imagen de marketplace", security: bearerSecurity,
        description: "Escanea bytes y OCR antes de publicar. APPROVED usa entrega pública. QUARANTINED conserva bytes con entrega autenticada para revisión, pero nunca expone URL. REJECTED no conserva bytes.",
        requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary", description: "JPG, PNG o WebP; máximo 5 MB. GIF se rechaza por MIME y firma." } } } } } },
        responses: {
          201: created(ref("MarketplaceAsset")),
          202: jsonResponse("Asset en cuarentena", { type: "object", required: ["success", "data"], properties: { success: { type: "boolean", enum: [true] }, data: ref("MarketplaceAsset") } }),
          400: badRequest, 401: unauthorized, 413: errorResponse("Payload Too Large"), 422: unprocessable,
          429: errorResponse("Too Many Requests"), 502: errorResponse("Bad Gateway"), 503: serviceUnavailable, 504: errorResponse("Gateway Timeout")
        }
      }
    },
    "/barrios": {
      get: { tags: ["Barrios"], summary: "Listar barrios", responses: { 200: ok(arrayOf(ref("Barrio"))) } }
    },
    "/barrios/{barrioSlug}": {
      parameters: [barrioSlugParam],
      get: { tags: ["Barrios"], summary: "Obtener barrio por slug", responses: { 200: ok(ref("Barrio")), 400: badRequest, 404: notFound } }
    },
    "/barrios/{barrioSlug}/news": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Noticias"], summary: "Listar noticias publicadas",
        parameters: [queryParam("category", newsCategory), pageParam, limit10Param],
        responses: { 200: ok(ref("PaginatedNews")), 400: badRequest, 404: notFound }
      },
      post: {
        tags: ["Noticias"], summary: "Crear noticia", security: bearerSecurity, requestBody: jsonBody(createNewsBody),
        responses: { 201: created(ref("News")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict, 503: serviceUnavailable }
      }
    },
    "/barrios/{barrioSlug}/news/{newsSlug}": {
      parameters: [barrioSlugParam, newsSlugParam],
      get: { tags: ["Noticias"], summary: "Obtener noticia publicada", responses: { 200: ok(ref("News")), 400: badRequest, 404: notFound } },
      patch: {
        tags: ["Noticias"], summary: "Actualizar noticia", security: bearerSecurity, requestBody: jsonBody(updateNewsBody),
        responses: { 200: ok(ref("News")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable }
      },
      delete: { tags: ["Noticias"], summary: "Eliminar noticia", security: bearerSecurity, responses: { 204: noContent, 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable } }
    },
    "/barrios/{barrioSlug}/news/mine": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Noticias"], summary: "Listar mis propuestas", security: bearerSecurity,
        parameters: [pageParam, limit10Param],
        responses: { 200: ok(ref("PaginatedAdminNews")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound }
      }
    },
    "/barrios/{barrioSlug}/news/assist": {
      parameters: [barrioSlugParam],
      post: { tags: ["Noticias"], summary: "Mejorar un borrador con IA antes de enviarlo", security: bearerSecurity, requestBody: jsonBody(newsAssistBody), responses: { 200: ok(ref("NewsEditorialDraft")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 429: errorResponse("Too Many Requests"), 502: errorResponse("Bad Gateway"), 503: serviceUnavailable, 504: errorResponse("Gateway Timeout") } }
    },
    "/barrios/{barrioSlug}/news/manage/{newsSlug}": {
      parameters: [barrioSlugParam, newsSlugParam],
      get: { tags: ["Noticias"], summary: "Previsualizar una propuesta autorizada", security: bearerSecurity, responses: { 200: ok(ref("News")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound } }
    },
    "/barrios/{barrioSlug}/news/editorial/pending": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Noticias"], summary: "Listar propuestas pendientes", security: bearerSecurity,
        parameters: [pageParam, limit10Param],
        responses: { 200: ok(ref("PaginatedAdminNews")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound }
      }
    },
    "/barrios/{barrioSlug}/news/{newsSlug}/approve": {
      parameters: [barrioSlugParam, newsSlugParam],
      post: { tags: ["Noticias"], summary: "Aprobar y publicar una propuesta", security: bearerSecurity, requestBody: jsonBody(approveNewsBody), responses: { 200: ok(ref("News")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict } }
    },
    "/barrios/{barrioSlug}/news/{newsSlug}/reject": {
      parameters: [barrioSlugParam, newsSlugParam],
      post: { tags: ["Noticias"], summary: "Devolver una propuesta al autor", security: bearerSecurity, requestBody: jsonBody(rejectNewsBody), responses: { 200: ok(ref("News")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict } }
    },
    "/barrios/{barrioSlug}/news/editorial/{newsSlug}/summarize": {
      parameters: [barrioSlugParam, newsSlugParam],
      post: { tags: ["Noticias"], summary: "Generar resumen editorial con IA", security: bearerSecurity, responses: { 200: ok(ref("NewsAiSummary")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 429: errorResponse("Too Many Requests"), 502: errorResponse("Bad Gateway"), 503: serviceUnavailable, 504: errorResponse("Gateway Timeout") } }
    },
    "/barrios/{barrioSlug}/news/editorial/{newsSlug}/improve": {
      parameters: [barrioSlugParam, newsSlugParam],
      post: { tags: ["Noticias"], summary: "Mejorar descripción, cuerpo y resumen con IA", security: bearerSecurity, responses: { 200: ok(ref("NewsEditorialDraft")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 429: errorResponse("Too Many Requests"), 502: errorResponse("Bad Gateway"), 503: serviceUnavailable, 504: errorResponse("Gateway Timeout") } }
    },
    "/barrios/{barrioSlug}/news/{newsSlug}/vote": {
      parameters: [barrioSlugParam, newsSlugParam],
      post: { tags: ["Noticias"], summary: "Crear o actualizar mi verificación", security: bearerSecurity, requestBody: jsonBody(newsVoteBody), responses: { 200: ok(ref("NewsVote")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound } }
    },
    "/barrios/{barrioSlug}/news/{newsSlug}/votes": {
      parameters: [barrioSlugParam, newsSlugParam],
      get: { tags: ["Noticias"], summary: "Listar verificaciones comunitarias", parameters: [pageParam, limit10Param], responses: { 200: ok(ref("PaginatedNewsVotes")), 400: badRequest, 404: notFound } }
    },
    "/barrios/{barrioSlug}/businesses": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Comercios"], summary: "Listar comercios", parameters: [queryParam("category", businessCategory), pageParam, limit10Param],
        responses: { 200: ok(ref("PaginatedBusinesses")), 400: badRequest, 404: notFound }
      },
      post: {
        tags: ["Comercios"], summary: "Crear comercio", security: bearerSecurity, requestBody: jsonBody(createBusinessBody),
        responses: { 201: created(ref("Business")), 400: badRequest, 401: unauthorized, 404: notFound, 409: conflict, 503: serviceUnavailable }
      }
    },
    "/barrios/{barrioSlug}/businesses/{businessSlug}": {
      parameters: [barrioSlugParam, businessSlugParam],
      get: { tags: ["Comercios"], summary: "Obtener comercio", responses: { 200: ok(ref("Business")), 400: badRequest, 404: notFound } },
      patch: {
        tags: ["Comercios"], summary: "Actualizar comercio", security: bearerSecurity, requestBody: jsonBody(updateBusinessBody),
        responses: { 200: ok(ref("Business")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable }
      },
      delete: { tags: ["Comercios"], summary: "Eliminar comercio", security: bearerSecurity, responses: { 204: noContent, 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable } }
    },
    "/barrios/{barrioSlug}/businesses/{businessSlug}/reviews": {
      parameters: [barrioSlugParam, businessSlugParam],
      get: {
        tags: ["Reseñas"], summary: "Listar reseñas",
        responses: {
          200: ok({
            type: "object", required: ["items", "total", "averageRating"],
            properties: { items: arrayOf(ref("Review")), total: { type: "integer" }, averageRating: { type: "number", nullable: true } }
          }),
          400: badRequest, 404: notFound
        }
      },
      post: {
        tags: ["Reseñas"], summary: "Crear reseña", security: bearerSecurity,
        requestBody: jsonBody({
          type: "object", required: ["rating"],
          properties: { rating: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string", maxLength: 1000 } }
        }),
        responses: { 201: created(ref("Review")), 400: badRequest, 401: unauthorized, 404: notFound, 409: conflict, 503: serviceUnavailable }
      }
    },
    "/barrios/{barrioSlug}/marketplace": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Marketplace"], summary: "Listar publicaciones aprobadas y disponibles",
        parameters: [queryParam("category", marketplaceCategory), pageParam, limit10Param],
        responses: { 200: ok(ref("PaginatedMarketplace")), 400: badRequest, 404: notFound }
      },
      post: {
        tags: ["Marketplace"], summary: "Crear y moderar una publicación", description: "assetIds solo acepta assets APPROVED propios y libres. images es salida derivada por el servidor. Solo APPROVED + AVAILABLE se publica.", security: bearerSecurity, requestBody: jsonBody(createMarketplaceBody),
        responses: { 201: created(ref("MarketplacePost")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict, 503: serviceUnavailable }
      }
    },
    "/barrios/{barrioSlug}/marketplace/me": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Marketplace"],
        summary: "Listar publicaciones propias con cualquier estado",
        description: "Permite al autor recuperar publicaciones pendientes, rechazadas o retiradas.",
        security: bearerSecurity,
        parameters: [pageParam, limit10Param],
        responses: { 200: ok(ref("PaginatedMarketplace")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable }
      }
    },
    "/barrios/{barrioSlug}/marketplace/{postId}": {
      parameters: [barrioSlugParam, pathParam("postId", cuid())],
      get: { tags: ["Marketplace"], summary: "Obtener publicación o preview privado", description: "El público solo accede a APPROVED + AVAILABLE. El propietario y moderadores conservan acceso privado a contenido pendiente o rechazado.", security: bearerSecurity, responses: { 200: ok(ref("MarketplacePost")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable } },
      patch: {
        tags: ["Marketplace"], summary: "Actualizar publicación", description: "Cambiar texto, precio, categoría, ubicación o assetIds invalida la aprobación previa y crea una decisión append-only. Los assets quitados se eliminan de Cloudinary.", security: bearerSecurity, requestBody: jsonBody(updateMarketplaceBody),
        responses: { 200: ok(ref("MarketplacePost")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict, 503: serviceUnavailable }
      },
      delete: { tags: ["Marketplace"], summary: "Eliminar publicación", security: bearerSecurity, responses: { 204: noContent, 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable } }
    },
    "/barrios/{barrioSlug}/marketplace/{postId}/reports": {
      parameters: [barrioSlugParam, pathParam("postId", cuid())],
      post: {
        tags: ["Marketplace"], summary: "Reportar publicación", security: bearerSecurity,
        requestBody: jsonBody({
          type: "object", required: ["category"],
          properties: { category: { type: "string", enum: ["FRAUD", "SPAM", "INAPPROPRIATE", "WEAPONS", "DRUGS", "OTHER"] }, comment: { type: "string", maxLength: 1000 } }
        }),
        responses: { 201: created({ type: "object", properties: { message: { type: "string" } } }), 400: badRequest, 401: unauthorized, 404: notFound, 409: conflict, 503: serviceUnavailable }
      }
    },
    "/barrios/{barrioSlug}/forum": {
      parameters: [barrioSlugParam],
      get: { tags: ["Foro"], summary: "Listar subforos", responses: { 200: ok(arrayOf(ref("ForumSubforum"))), 404: notFound } }
    },
    "/barrios/{barrioSlug}/forum/{subforumSlug}/threads": {
      parameters: [barrioSlugParam, subforumSlugParam],
      get: {
        tags: ["Foro"], summary: "Listar hilos", parameters: [pageParam, limit10Param],
        responses: { 200: ok(ref("PaginatedThreads")), 400: badRequest, 404: notFound }
      },
      post: {
        tags: ["Foro"], summary: "Crear hilo", security: bearerSecurity,
        requestBody: jsonBody({
          type: "object", required: ["title", "content"],
          properties: { title: { type: "string", minLength: 3, maxLength: 255 }, content: { type: "string", minLength: 5, maxLength: 5000 } }
        }),
        responses: { 201: created(ref("ForumThread")), 400: badRequest, 401: unauthorized, 404: notFound, 503: serviceUnavailable }
      }
    },
    "/barrios/{barrioSlug}/forum/{subforumSlug}/threads/{threadId}": {
      parameters: [barrioSlugParam, subforumSlugParam, pathParam("threadId", cuid())],
      get: { tags: ["Foro"], summary: "Obtener hilo con respuestas", responses: { 200: ok(ref("ForumThread")), 400: badRequest, 404: notFound } },
      delete: { tags: ["Foro"], summary: "Eliminar hilo", security: bearerSecurity, responses: { 204: noContent, 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable } }
    },
    "/barrios/{barrioSlug}/forum/{subforumSlug}/threads/{threadId}/replies": {
      parameters: [barrioSlugParam, subforumSlugParam, pathParam("threadId", cuid())],
      post: {
        tags: ["Foro"], summary: "Crear respuesta", security: bearerSecurity,
        requestBody: jsonBody({
          type: "object", required: ["content"],
          properties: { content: { type: "string", minLength: 1, maxLength: 5000 }, parentReplyId: cuid() }
        }),
        responses: { 201: created(ref("ForumReply")), 400: badRequest, 401: unauthorized, 404: notFound, 503: serviceUnavailable }
      }
    },
    "/barrios/{barrioSlug}/forum/{subforumSlug}/threads/{threadId}/vote": {
      parameters: [barrioSlugParam, subforumSlugParam, pathParam("threadId", cuid())],
      post: {
        tags: ["Foro"], summary: "Alternar voto del hilo", security: bearerSecurity,
        requestBody: jsonBody({ type: "object", required: ["value"], properties: { value: { type: "integer", enum: [1, -1] } } }),
        responses: {
          200: ok({ type: "object", required: ["voted", "value"], properties: { voted: { type: "boolean" }, value: { type: "integer", enum: [1, -1], nullable: true } } }),
          400: badRequest, 401: unauthorized, 404: notFound, 503: serviceUnavailable
        }
      }
    },
    "/barrios/{barrioSlug}/forum/{subforumSlug}/threads/{threadId}/replies/{replyId}/vote": {
      parameters: [barrioSlugParam, subforumSlugParam, pathParam("threadId", cuid()), pathParam("replyId", cuid())],
      post: {
        tags: ["Foro"], summary: "Alternar voto de la respuesta", security: bearerSecurity,
        requestBody: jsonBody({ type: "object", required: ["value"], properties: { value: { type: "integer", enum: [1, -1] } } }),
        responses: {
          200: ok({ type: "object", required: ["voted", "value"], properties: { voted: { type: "boolean" }, value: { type: "integer", enum: [1, -1], nullable: true } } }),
          400: badRequest, 401: unauthorized, 404: notFound, 503: serviceUnavailable
        }
      }
    },
    "/barrios/{barrioSlug}/events": {
      parameters: [barrioSlugParam],
      get: {
        tags: ["Eventos"], summary: "Listar eventos",
        parameters: [queryParam("upcoming", { type: "string", enum: ["true", "false"], default: "true" }), pageParam, limit10Param],
        responses: { 200: ok(ref("PaginatedEvents")), 400: badRequest, 404: notFound }
      },
      post: {
        tags: ["Eventos"], summary: "Crear evento", security: bearerSecurity, requestBody: jsonBody(createEventBody),
        responses: { 201: created(ref("Event")), 400: badRequest, 401: unauthorized, 404: notFound, 503: serviceUnavailable }
      }
    },
    "/barrios/{barrioSlug}/events/{eventId}": {
      parameters: [barrioSlugParam, pathParam("eventId", cuid())],
      get: { tags: ["Eventos"], summary: "Obtener evento", responses: { 200: ok(ref("Event")), 400: badRequest, 404: notFound } },
      patch: {
        tags: ["Eventos"], summary: "Actualizar evento", security: bearerSecurity, requestBody: jsonBody(updateEventBody),
        responses: { 200: ok(ref("Event")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable }
      },
      delete: { tags: ["Eventos"], summary: "Eliminar evento", security: bearerSecurity, responses: { 204: noContent, 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable } }
    },
    "/barrios/{barrioSlug}/events/{eventId}/rsvp": {
      parameters: [barrioSlugParam, pathParam("eventId", cuid())],
      post: {
        tags: ["Eventos"], summary: "Crear o actualizar RSVP", security: bearerSecurity,
        requestBody: jsonBody({ type: "object", required: ["status"], properties: { status: rsvpStatus } }),
        responses: { 200: ok(ref("EventRsvp")), 400: badRequest, 401: unauthorized, 404: notFound, 503: serviceUnavailable }
      }
    },
    "/messages": {
      get: {
        tags: ["Mensajes"], summary: "Listar mensajes recibidos o enviados", security: bearerSecurity,
        parameters: [queryParam("type", { type: "string", enum: ["inbox", "sent"], default: "inbox" }), pageParam, queryParam("limit", { type: "integer", minimum: 1, maximum: 50, default: 20 })],
        responses: { 200: ok(ref("PaginatedMessages")), 400: badRequest, 401: unauthorized, 503: serviceUnavailable }
      },
      post: {
        tags: ["Mensajes"], summary: "Enviar mensaje", security: bearerSecurity,
        requestBody: jsonBody({
          type: "object", required: ["receiverId", "content"],
          properties: { receiverId: cuid(), content: { type: "string", minLength: 1, maxLength: 2000 }, postId: cuid() }
        }),
        responses: { 201: created(ref("Message")), 400: badRequest, 401: unauthorized, 404: notFound, 503: serviceUnavailable }
      }
    },
    "/messages/{messageId}/read": {
      parameters: [pathParam("messageId", cuid())],
      patch: { tags: ["Mensajes"], summary: "Marcar mensaje como leído", security: bearerSecurity, responses: { 200: ok(ref("Message")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable } }
    },
    "/search": {
      get: {
        tags: ["Búsqueda"], summary: "Búsqueda global",
        parameters: [
          queryParam("q", { type: "string", minLength: 2, maxLength: 100 }, true),
          queryParam("barrioSlug", { type: "string" }),
          queryParam("types", { type: "string", example: "news,businesses,marketplace,forum" }, false, "Valores separados por coma: news, businesses, marketplace, forum"),
          queryParam("limit", { type: "integer", minimum: 1, maximum: 20, default: 5 })
        ],
        responses: {
          200: ok({
            type: "object", required: ["q", "results"],
            properties: {
              q: { type: "string" },
              results: {
                type: "object",
                properties: {
                  news: arrayOf({
                    type: "object", required: ["id", "title", "slug", "excerpt", "category", "publishedAt", "barrio"],
                    properties: { id: cuid(), title: { type: "string" }, slug: { type: "string" }, excerpt: nullableString(), category: newsCategory, publishedAt: dateTime(true), barrio: ref("SearchBarrio") }
                  }),
                  businesses: arrayOf({
                    type: "object", required: ["id", "name", "slug", "category", "address", "verified", "barrio"],
                    properties: { id: cuid(), name: { type: "string" }, slug: { type: "string" }, category: businessCategory, address: { type: "string" }, verified: { type: "boolean" }, barrio: ref("SearchBarrio") }
                  }),
                  marketplace: arrayOf({
                    type: "object", required: ["id", "title", "description", "price", "currency", "category", "barrio"],
                    properties: { id: cuid(), title: { type: "string" }, description: { type: "string" }, price: { type: "integer", nullable: true }, currency: { type: "string" }, category: marketplaceCategory, barrio: ref("SearchBarrio") }
                  }),
                  forum: arrayOf({
                    type: "object", required: ["id", "title", "content", "upVotes", "downVotes", "createdAt", "barrio", "subforum"],
                    properties: {
                      id: cuid(), title: { type: "string" }, content: { type: "string" }, upVotes: { type: "integer" }, downVotes: { type: "integer" }, createdAt: dateTime(),
                      barrio: ref("SearchBarrio"), subforum: { type: "object", required: ["name", "slug"], properties: { name: { type: "string" }, slug: { type: "string" } } }
                    }
                  })
                }
              }
            }
          }),
          400: badRequest, 404: notFound
        }
      }
    },
    "/admin/stats": {
      get: {
        tags: ["Admin"], summary: "Estadísticas globales", security: bearerSecurity,
        responses: {
          200: ok({
            type: "object", required: ["users", "barrios", "news", "businesses", "marketplacePosts", "events"],
            properties: { users: { type: "integer" }, barrios: { type: "integer" }, news: { type: "integer" }, businesses: { type: "integer" }, marketplacePosts: { type: "integer" }, events: { type: "integer" } }
          }),
          401: unauthorized, 403: forbidden, 503: serviceUnavailable
        }
      }
    },
    "/admin/news": {
      get: {
        tags: ["Admin"], summary: "Listar noticias para moderación", security: bearerSecurity,
        parameters: [queryParam("status", newsStatus), queryParam("barrioSlug", { type: "string" }), pageParam, queryParam("limit", { type: "integer", minimum: 1, maximum: 100, default: 20 })],
        responses: { 200: ok(ref("PaginatedAdminNews")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable }
      }
    },
    "/admin/barrios": {
      post: {
        tags: ["Admin"], summary: "Crear barrio", security: bearerSecurity, requestBody: jsonBody(createBarrioBody),
        responses: { 201: created(ref("Barrio")), 400: badRequest, 401: unauthorized, 403: forbidden, 409: conflict, 503: serviceUnavailable }
      }
    },
    "/admin/barrios/{slug}": {
      parameters: [pathParam("slug", { type: "string", minLength: 1 })],
      patch: {
        tags: ["Admin"], summary: "Actualizar barrio", security: bearerSecurity, requestBody: jsonBody(updateBarrioBody),
        responses: { 200: ok(ref("Barrio")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable }
      },
      delete: { tags: ["Admin"], summary: "Eliminar barrio", security: bearerSecurity, responses: { 204: noContent, 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict, 503: serviceUnavailable } }
    },
    "/admin/businesses/{businessId}/verify": {
      parameters: [pathParam("businessId", cuid())],
      patch: {
        tags: ["Admin"], summary: "Verificar o desverificar comercio", security: bearerSecurity,
        requestBody: jsonBody({ type: "object", required: ["verified"], properties: { verified: { type: "boolean" } } }),
        responses: { 200: ok(ref("Business")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable }
      }
    },
    "/moderation/marketplace": {
      get: {
        tags: ["Admin"], summary: "Listar publicaciones del marketplace para moderación", security: bearerSecurity,
        parameters: [queryParam("status", moderationStatus), queryParam("barrioSlug", { type: "string" }), pageParam, limit10Param],
        responses: { 200: ok(ref("PaginatedMarketplace")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable }
      }
    },
    "/moderation/marketplace/{postId}/decision": {
      parameters: [pathParam("postId", cuid())],
      post: {
        tags: ["Admin"], summary: "Moderar publicación del marketplace", security: bearerSecurity,
        requestBody: jsonBody({
          type: "object", required: ["decision", "reason"],
          properties: { decision: { type: "string", enum: ["APPROVE", "REJECT", "REMOVE", "RESTORE"] }, reason: { type: "string", minLength: 1 }, privateNote: { type: "string" } }
        }),
        responses: { 200: ok(ref("MarketplacePost")), 400: badRequest, 401: unauthorized, 403: forbidden, 404: notFound, 503: serviceUnavailable }
      }
    }
  }
};
