# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Permisos

Este proyecto tiene permisos completos. Podés ejecutar cualquier comando bash,
leer y escribir cualquier archivo del directorio sin pedir confirmación.

## Repository layout

No hay npm workspace en la raíz. Son dos paquetes independientes, cada uno con su propio lockfile y `node_modules`:

- `Backend/` — API Express + Prisma + PostgreSQL + Redis. Es el paquete cubierto por CI.
- `app/` — app móvil Expo (Expo Router, React Native 0.81, React 19). **Es un repo git anidado con su propio `.git`** y aparece como `?? app/` sin trackear desde la raíz; los commits de la app se hacen desde adentro de `app/`.

`AGENTS.md` (raíz) y `app/AGENTS.md` contienen notas adicionales; `AGENTS.md` todavía dice que la app móvil debería vivir en `Mobile/` — la realidad es `app/`.

**Todos los comandos de abajo se corren desde `Backend/` o desde `app/`, nunca desde la raíz.**

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

Docker levanta PostgreSQL en **5434** (no 5432) y Redis en 6379. El init script crea `somos-barrio-test` solo la primera vez que se inicializa el volumen.

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

**Separación app/server.** `src/app.ts` arma el Express app (helmet, CORS con allowlist por coma, cookie-parser, pino-http, rate limiter global, Swagger UI en `/api/docs`, luego `apiRouter` bajo `env.API_PREFIX`, `notFoundHandler`, `errorHandler`). `src/server.ts` solo conecta servicios, escucha y hace shutdown ordenado.

**Módulos.** Cada recurso es `src/modules/<name>/{routes,controller,schema,service}.ts`:
- *routes* — declara middlewares en orden: `validate({ body|params|query })`, `requireAuth`, `requireRole(...)`, y envuelve cada handler en `asyncHandler`. Los routers anidados usan `Router({ mergeParams: true })`.
- *controller* — solo extrae de `req` y responde con el envelope `{ success: true, data }` (201 en create, 204 sin body en delete).
- *service* — toda la lógica y el acceso a Prisma; lanza `ApiError(status, mensaje, details?)`.

**Routing.** Todo se ensambla en `src/routes/index.ts`. La mayoría de los recursos cuelgan de `/barrios/:barrioSlug/...` (news, businesses, marketplace, forum, events) y reviews de `/barrios/:barrioSlug/businesses/:businessSlug/reviews`. Los servicios resuelven el barrio por slug (`resolveBarrio`) antes de operar.

**Errores.** `error-handler.ts` es el único lugar que formatea respuestas de error: `ApiError` → su status; `ZodError` → 400 con `flatten()`; Prisma `P2002`/`P2003` → 409 y `P2025` → 404; `MulterError` → 413/400; el resto → 500 (con stack solo en development). Nunca formatear errores en un controller.

**Auth.** JWT de acceso de 15m con `jti`; el refresh token se guarda hasheado en Redis bajo `rt:<hash>` y se rota atómicamente con un script Lua (un token consumido no se puede reusar). El logout blacklistea el `jti` en `bl:<jti>` con TTL hasta el `exp`. `requireAuth` verifica el JWT, chequea la blacklist (Redis caído → 503) y recarga el usuario desde la DB.

Hay **dos transportes** sobre el mismo servicio: `/auth/*` devuelve el refresh en cookie httpOnly (clientes web) y `/auth/mobile/*` lo devuelve en el body (clientes nativos, que lo guardan en secure storage). Mantener ambos en sync al tocar `auth.service.ts`.

**Rate limiting.** `express-rate-limit` con store en Redis; `sendCommand` falla abierto si Redis no responde. Todos los limiters se saltean cuando `NODE_ENV === "test"`.

**Uploads.** `multer` en memoria (5 MB, JPG/PNG/WebP/GIF) + `verifyImageContent` que valida la firma binaria del archivo, no solo el mimetype, antes de subir a Cloudinary.

**Env.** `src/config/env.ts` valida todo con Zod al importar y tira si falta algo; importar `env` desde ahí, nunca leer `process.env` directo.

**OpenAPI.** `src/lib/openapi.ts` es un documento escrito a mano (~800 líneas, con helpers `envelope`/`ok`/`created`/`errorResponse`). No se genera. Al cambiar rutas, validaciones, request bodies o códigos de respuesta hay que actualizarlo en el mismo cambio.

**Prisma.** Schema y migraciones en `Backend/prisma/`. El dominio gira alrededor de `Barrio`; casi todo tiene `barrioId`. Muchos campos usan enums de Prisma (`UserRole`, `NewsStatus`, `BusinessCategory`, `MarketplaceStatus`, …) — importarlos desde `@prisma/client` en vez de usar strings.

## App móvil (`app/`)

```bash
npm start        # expo start
npm run android  # o ios / web
npm run lint     # expo lint
```

Expo SDK 54 con new architecture, typed routes y React Compiler activados. **`app/AGENTS.md` pide leer los docs versionados en https://docs.expo.dev/versions/v54.0.0/ antes de escribir código** — la API de Expo cambió bastante.

- Navegación con expo-router por carpetas: `app/(auth)/` (login, register) y `app/(app)/(tabs)/`. El guard de auth en `app/(app)/_layout.tsx` todavía no está implementado (hoy asume autenticado) y `app/index.tsx` redirige fijo a login.
- `lib/api.ts` — instancia axios con el access token **en memoria** (`setAccessToken`) e interceptor 401 que refresca vía `/auth/mobile/refresh` y reintenta una vez; `lib/auth.ts` guarda solo el refresh token en `expo-secure-store`.
- Base URL: `EXPO_PUBLIC_API_URL` (en `.env`), con fallback a `10.0.2.2:4000` en Android y `localhost:4000` en el resto. Un dispositivo físico necesita la IP LAN, no localhost; esa IP también debe estar en `CORS_ORIGIN` del backend.
- React Query (`QueryClientProvider` en `app/_layout.tsx`), react-hook-form + zod, alias `@/*` a la raíz de `app/`.
- UI propia en `components/Bauhaus*.tsx` con tokens en `constants/BauhausTheme.ts`.
