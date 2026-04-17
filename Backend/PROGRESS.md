# PROGRESS — Somos Barrio Backend

## Estado general

El servidor corre con `npm run dev` sin errores. TypeScript compila sin advertencias (`npm run typecheck`).  
**26 unit tests + 49 integration tests** (`npm run test:all`).  
Todos los endpoints probados end-to-end tanto con curl como con tests de integración.  
Redis y PostgreSQL corren como contenedores Docker (`docker compose up -d`).  
CI/CD configurado en `.github/workflows/ci.yml` (GitHub Actions).

---

## Lo que está hecho

### Infraestructura base
- Express 4 + TypeScript con `tsx watch` en modo dev
- Middleware global: CORS, Helmet, Morgan, Pino HTTP, Cookie-Parser
- Rate limiting global + auth (Redis, fail-open si Redis no responde)
- Variables de entorno validadas con Zod (`src/config/env.ts`)
- Prisma Client singleton (`src/lib/prisma.ts`)
- Redis con ioredis y `lazyConnect` (`src/lib/redis.ts`)
- Manejo centralizado de errores (`src/middlewares/error-handler.ts`)
- Validación de request con Zod (`src/middlewares/validate.ts`)
- `asyncHandler` para controllers async
- `ApiError` con statusCode

### Autenticación (`/api/v1/auth`)
- `POST /register` — Registro con email + password + nombre + barrioSlug opcional
- `POST /login` — Login; devuelve `accessToken` en body + `refresh_token` en httpOnly cookie
- `POST /refresh` — Rota el refresh token y emite nuevo access token (cookie rotation)
- `POST /logout` — Blacklistea el JWT por `jti` en Redis + invalida el refresh token
- `GET /me` — Usuario autenticado
- Middlewares `requireAuth` (async, verifica blacklist Redis, fail-open) y `requireRole`

### Schema Prisma (migración aplicada)
Todos los modelos:
- `Barrio`, `User`, `Business`, `News`, `MarketplacePost`
- `ForumSubforum`, `ForumThread`, `ForumReply`, **`ForumVote`** (nuevo)
- `Event`, `EventRsvp`, `Message`, `Review`

### Seed
`npm run seed` crea barrio, admin, comerciante, 5 subforos y comercio demo.

### Módulo Barrios (`/api/v1/barrios`)
- `GET /` — Lista todos los barrios
- `GET /:barrioSlug` — Obtiene barrio por slug

### Módulo Noticias (`/api/v1/barrios/:barrioSlug/news`)
- `GET /` — Lista noticias publicadas (filtro `category`, paginación)
- `GET /:newsSlug` — Obtiene noticia publicada
- `POST /` — Crea (EDITOR/ADMIN)
- `PATCH /:newsSlug` — Actualiza; cambia status a PUBLISHED setea `publishedAt`
- `DELETE /:newsSlug` — Elimina (autor o ADMIN)

### Módulo Comercios (`/api/v1/barrios/:barrioSlug/businesses`)
- CRUD completo. `verified` lo setea admin.

### Módulo Marketplace (`/api/v1/barrios/:barrioSlug/marketplace`)
- CRUD completo. GET incrementa `views`.

### Módulo Foro (`/api/v1/barrios/:barrioSlug/forum`)
- Subforos, hilos y respuestas anidadas (2 niveles)
- `POST /:subforumSlug/threads/:threadId/vote` — Upvote/downvote con toggle (valor 1 o -1)
- `POST /:subforumSlug/threads/:threadId/replies/:replyId/vote` — Voto en respuestas
- Transacciones atómicas para mantener contadores consistentes

### Módulo Eventos (`/api/v1/barrios/:barrioSlug/events`)
- CRUD + `POST /:eventId/rsvp` (upsert de asistencia)

### Módulo Mensajes (`/api/v1/messages`)
- Inbox/sent paginado, enviar mensaje, marcar como leído

### Módulo Reseñas
- `GET/POST /barrios/:barrioSlug/businesses/:businessSlug/reviews`
- Promedio de rating calculado, una reseña por usuario por comercio

### Módulo Admin (`/api/v1/admin`) — solo ADMIN
- `GET /stats` — Conteos globales
- `GET /news` — Lista noticias con filtro de status (moderación)
- `POST /barrios` — Crear barrio
- `PATCH /barrios/:slug` — Actualizar barrio
- `DELETE /barrios/:slug` — Borrar barrio (en cascada)
- `PATCH /businesses/:businessId/verify` — Verificar/desverificar comercio

### Módulo Search (`/api/v1/search`)
- `GET /?q=texto&barrioSlug=...&types=news,businesses,marketplace,forum`
- Búsqueda ILIKE en simultáneo sobre los 4 módulos
- `types` permite elegir en qué módulos buscar

### Documentación OpenAPI (`/api/docs`)
- Swagger UI en `http://localhost:4000/api/docs`
- Spec completo: todos los endpoints, parámetros, request bodies, respuestas y schemas
- Generado desde `src/lib/openapi.ts` (spec manual tipado con `openapi-types`)
- `bearerAuth` configurado para probar endpoints protegidos directamente desde la UI

### Tests
- `npm test` — 26 tests, 3 suites, 0 fallos
- `src/modules/auth/auth.service.test.ts` — register, login, refresh, logout
- `src/middlewares/auth.test.ts` — requireAuth (token inválido, blacklist, fail-open Redis), requireRole
- `src/middlewares/validate.test.ts` — body, params, query, defaults, combinación

---

## Lo que queda pendiente

### Funcionalidades no implementadas
- ~~**Subida de imágenes**~~ ✅ **HECHO** — `POST /api/v1/upload` con Cloudinary (multer + upload_stream)
- **Autenticación OAuth** — Schema soporta Google/Facebook pero endpoints no implementados.
- **Notificaciones** — Sin WebSocket ni push notifications.
- **Búsqueda avanzada** — Actualmente usa ILIKE. Para producción: `pg_trgm` o Elasticsearch.
- **Paginación cursor-based** — Los listados usan offset; para feeds de alta frecuencia conviene cursor.

### Calidad / operaciones
- ~~**Tests de integración**~~ ✅ **HECHO** — 49 tests con supertest + BD real (`npm run test:integration`)
- ~~**CI/CD**~~ ✅ **HECHO** — `.github/workflows/ci.yml` con Postgres+Redis services
- **Logs centralizados en producción** — Pino está configurado, falta destino (Datadog, Loki, etc.)
- ~~**Documentación OpenAPI**~~ ✅ **HECHO**

---

## Cómo correr el proyecto

```bash
# 1. Levantar servicios (PostgreSQL + Redis)
docker compose up -d

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Instalar dependencias
npm install

# 4. Aplicar migraciones
npx prisma migrate deploy

# 5. Cargar datos de prueba
npm run seed

# 6. Iniciar en modo desarrollo
npm run dev

# 7. Correr tests
npm test
```

El servidor queda disponible en `http://localhost:4000/api/v1`.

**Credenciales de prueba:**
- Admin: `admin@somosbarrio.local` / `Admin1234!`
- Comerciante: `local@somosbarrio.local` / `Local1234!`
