# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Permisos

Este proyecto tiene permisos completos. Podés ejecutar cualquier comando bash,
leer y escribir cualquier archivo del directorio sin pedir confirmación.

## Repository layout

No hay npm workspace en la raíz. Son dos paquetes independientes, cada uno con su propio lockfile y `node_modules`:

- `Backend/` — API Express + Prisma + PostgreSQL + Redis. Es el paquete cubierto por CI.
- `app/` — app móvil Expo (Expo Router, React Native 0.81, React 19). Pertenece al mismo repositorio Git raíz que `Backend/`, aunque conserva su propio manifest y lockfile.

`AGENTS.md` (raíz) y `app/AGENTS.md` contienen notas adicionales.

**Todos los comandos de abajo se corren desde `Backend/` o desde `app/`, nunca desde la raíz.** Node >= 20 (CI usa 20).

## Backend — comandos

```bash
npm run dev              # tsx watch src/server.ts → http://localhost:4000/api/v1
npm run typecheck        # tsc --noEmit
npm run build            # tsc -p tsconfig.build.json → dist/server.js
npm start                # node dist/server.js
npm run seed             # tsx prisma/seed.ts
npm run prisma:migrate -- --name <nombre>   # crear migración
npm run prisma:generate  # regenerar cliente Prisma
npm run prisma:studio
```

Setup desde checkout limpio: `npm ci`, `cp .env.example .env`, `docker compose up -d`, `npx prisma migrate deploy`, `npm run prisma:generate`, `npm run seed`.

Docker levanta PostgreSQL en **5432** y Redis en 6379. El init script crea `somos-barrio-test` solo la primera vez que se inicializa el volumen.

No hay script de lint en el backend.

## Backend — tests

```bash
npm test                                    # unit (vitest, excluye *.integration.test.ts)
npm test -- src/middlewares/validate.test.ts   # un solo archivo
npm run test:integration                    # requiere .env.test (cp .env.test.example .env.test)
npm run test:integration -- src/modules/auth/auth.integration.test.ts
npm run test:all
```

Los tests de integración usan PostgreSQL y Redis reales, corren en serie (`maxWorkers: 1`), aplican migraciones en `global-setup.ts` y borran todas las tablas de dominio en `beforeAll`. `src/test/assert-test-database.ts` aborta si `DATABASE_URL` no apunta exactamente a la base `somos-barrio-test` — **no debilitar esa protección**. Los tests importan `app` desde `src/app.ts` con supertest sin abrir un puerto.

Verificación equivalente a CI (`.github/workflows/ci.yml`, solo corre sobre `Backend/**`):
`npm run prisma:generate` → `npm run typecheck` → `npm run build` → `npx prisma migrate deploy` → `npm test` → `npm run test:integration`.

## Backend — arquitectura

**Separación app/server.** `src/app.ts` arma el Express app (helmet, CORS con allowlist por coma, cookie-parser, pino-http, rate limiter global, Swagger UI en `/api/docs`, luego `apiRouter` bajo `env.API_PREFIX`, `notFoundHandler`, `errorHandler`). `src/server.ts` conecta DB/Redis, escucha, arranca los workers en proceso (`startNotificationProcessor`, `startMarketplaceAssetCleanup`, ambos con `setInterval`) y hace shutdown ordenado deteniéndolos. Los tests no pasan por `server.ts`, así que los workers no corren ahí: se testean invocando sus funciones directamente.

**Módulos.** Cada recurso es `src/modules/<name>/{routes,controller,schema,service}.ts`:
- *routes* — declara middlewares en orden: `validate({ body|params|query })`, `requireAuth`, `requireRole(...)`, y envuelve cada handler en `asyncHandler`. Los routers anidados usan `Router({ mergeParams: true })`.
- *controller* — solo extrae de `req` y responde con el envelope `{ success: true, data }` (201 en create, 204 sin body en delete).
- *service* — toda la lógica y el acceso a Prisma; lanza `ApiError(status, mensaje, details?)`.

**Routing.** Todo se ensambla en `src/routes/index.ts`. La mayoría de los recursos cuelgan de `/barrios/:barrioSlug/...` (news, businesses, marketplace, forum, events) y reviews de `/barrios/:barrioSlug/businesses/:businessSlug/reviews`. Fuera de barrio: `/auth`, `/upload`, `/search`, `/admin`, `/moderation` (cola de revisión humana, `EDITOR`/`ADMIN`), `/messages`, `/notifications`. Los servicios resuelven el barrio por slug (`resolveBarrio`) antes de operar.

**Errores.** `error-handler.ts` es el único lugar que formatea respuestas de error: `ApiError` → su status; `ZodError` → 400 con `flatten()`; Prisma `P2002`/`P2003` → 409 y `P2025` → 404; `MulterError` → 413/400; el resto → 500 (con stack solo en development). Nunca formatear errores en un controller.

**Auth.** JWT de acceso de 15m con `jti`; el refresh token se guarda hasheado en Redis bajo `rt:<hash>` y se rota atómicamente con un script Lua (un token consumido no se puede reusar). El logout blacklistea el `jti` en `bl:<jti>` con TTL hasta el `exp`. `requireAuth` verifica el JWT, chequea la blacklist (Redis caído → 503) y recarga el usuario desde la DB.

Hay **dos transportes** sobre el mismo servicio: `/auth/*` devuelve el refresh en cookie httpOnly (clientes web) y `/auth/mobile/*` lo devuelve en el body (clientes nativos, que lo guardan en secure storage). Mantener ambos en sync al tocar `auth.service.ts`.

**Rate limiting.** `express-rate-limit` con store en Redis; `sendCommand` falla abierto si Redis no responde. Todos los limiters se saltean cuando `NODE_ENV === "test"`.

**Uploads.** `multer` en memoria (5 MB, JPG/PNG/WebP/GIF) + `verifyImageContent` que valida la firma binaria del archivo, no solo el mimetype, antes de subir a Cloudinary.

**Moderación de contenido (marketplace).** `modules/content-moderation/` no es un módulo HTTP: es una librería usada por otros servicios.
- Texto: `contentModerationService.evaluate(text, domain)` normaliza (`content-normalizer.ts`, basado en NFKD) y aplica la política `policies/es-AR.ts` vía `ContentPolicy`. No exponer al usuario qué regla disparó.
- Imágenes: `upload/marketplace-asset.service.ts` escanea con Sightengine (`sightengine.provider.ts`, umbrales `review`/`block` por categoría en `SIGHTENGINE_THRESHOLDS`) y pasa el OCR por la misma política de texto. Los assets arrancan `QUARANTINED` y transicionan por `MarketplaceAssetStatus`; `marketplace-asset.cleanup.ts` limpia huérfanos.
- Posts: `moderationStatus` (`ModerationStatus`) con historial en `MarketplaceModerationDecision`; reportes de usuarios (`MARKETPLACE_REPORT_THRESHOLD`) mandan a revisión, y hay apelaciones. Las decisiones humanas entran por `modules/moderation/`.
- Foro: hilos y respuestas tienen `status` (`ForumContentStatus`: PUBLISHED/PENDING_REVIEW/BLOCKED/REMOVED) asignado al crear o editar. Solo PUBLISHED sale en listados, conteos (`_count` filtrado), búsqueda y push; el autor ve lo propio vía `optionalAuth`. `moderationRuleId`/`moderationContentHash` se excluyen de las respuestas con `omit`. La push de respuestas se encola una sola vez, guiada por `ForumReply.publishedAt`.
- Las reglas pueden limitarse por `domains` (armas/drogas solo aplican a MARKETPLACE) y los REGEX con `target: 'NORMALIZED'` evalúan la frase con espacios en vez del texto compacto.

**Notificaciones push.** Patrón outbox: los servicios llaman `notificationsService.enqueue(tx, ...)` **dentro de la transacción de Prisma** que crea el contenido (ver `forum.service.ts`, `news.service.ts`); `notifications.processor.ts` reclama filas de `NotificationOutbox` con lock optimista (`lockToken`, lock vencido a los 5 min), envía vía Expo push y reintenta con `nextAttemptAt`.

**IA en noticias.** `news/ai.provider.ts` llama a un endpoint compatible con OpenAI (`AI_PROVIDER_URL`/`AI_MODEL`, por defecto LM Studio local) para resumir/mejorar noticias, con `prompt-injection.guard.ts` y `ai.limiter.ts` (límite diario por usuario, presupuesto global de tokens, concurrencia, cache). `AI_ENABLED=false` lo desactiva.

**Env.** `src/config/env.ts` valida todo con Zod al importar y tira si falta algo; importar `env` desde ahí, nunca leer `process.env` directo.

**OpenAPI.** `src/lib/openapi.ts` es un documento escrito a mano (~800 líneas, con helpers `envelope`/`ok`/`created`/`errorResponse`). No se genera. Al cambiar rutas, validaciones, request bodies o códigos de respuesta hay que actualizarlo en el mismo cambio.

**Prisma.** Schema y migraciones en `Backend/prisma/`. El dominio gira alrededor de `Barrio`; casi todo tiene `barrioId`. Muchos campos usan enums de Prisma (`UserRole`, `NewsStatus`, `BusinessCategory`, `ModerationStatus`, `MarketplaceAssetStatus`, …) — importarlos desde `@prisma/client` en vez de usar strings. Tras cambiar el schema: `prisma:migrate` + `prisma:generate` y commitear la migración; CI solo hace `migrate deploy`.

## App móvil (`app/`)

```bash
npm start        # expo start
npm run android  # o ios / web
npm run lint     # expo lint
npx tsc --noEmit # typecheck (no hay script)
```

No hay tests ni CI para la app móvil: verificar con lint + typecheck.

Expo SDK 54 con new architecture, typed routes y React Compiler activados. **`app/AGENTS.md` pide leer los docs versionados en https://docs.expo.dev/versions/v54.0.0/ antes de escribir código** — la API de Expo cambió bastante.

- Navegación con expo-router por carpetas bajo `app/app/`: `(auth)/` (login, register) y `(app)/` con `(tabs)/` más pantallas stack/modales (detalle, create-*, `admin-market-queue`, etc.). `app/index.tsx` redirige a `(app)/(tabs)`.
- `app/(app)/_layout.tsx` es el guard: usa `hooks/useAuth.ts` (React Query), redirige a login si no hay usuario, bloquea si el usuario no tiene `barrio.slug` (casi todo el API cuelga del barrio) y registra push notifications (`lib/notifications.ts`, navegación desde la notificación vía `getNotificationRoute`).
- `lib/api.ts` — instancia axios con el access token **en memoria** e interceptor 401 que refresca vía `/auth/mobile/refresh` (con cola para requests concurrentes) y reintenta; `lib/auth.ts` guarda solo el refresh token en `expo-secure-store`.
- Base URL: `EXPO_PUBLIC_API_URL` (URL absoluta, obligatoria fuera de `__DEV__`), con fallback en dev a `http://10.0.2.2:4000/api/v1` en Android y `http://localhost:4000/api/v1` en el resto. Un dispositivo físico necesita la IP LAN; esa IP también debe estar en `CORS_ORIGIN` del backend.
- `app.config.ts` genera `google-services.json` desde variables `FIREBASE_*` (todas o ninguna; package `com.somosbarrio.app`). Push nativo requiere dev client (`expo-dev-client`), no Expo Go.
- React Query (`QueryClientProvider` en `app/_layout.tsx`), react-hook-form + zod (v4 en la app, v3 en el backend), alias `@/*` a la raíz de `app/`.
- UI propia en `components/Clay*.tsx` con tokens en `constants/ClayTheme.ts`.
