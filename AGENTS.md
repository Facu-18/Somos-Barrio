# Somos Barrio Agent Notes

## Repository Boundaries

- There is no root npm workspace. Run npm commands from the package they target; `Backend/` and `app/` have separate manifests, lockfiles, and `node_modules`.
- `Backend/` and `app/` belong to the same root Git repository even though they remain independent npm packages.
- Root CI watches only `Backend/**` and `.github/workflows/ci.yml`; mobile changes receive no CI verification.
- Use Node 20 or newer. CI uses Node 20 and `Backend/package.json` requires `>=20`.

## Backend

- Run from `Backend/`. Clean setup is `npm ci`, copy `.env.example` to `.env`, `docker compose up -d`, `npx prisma migrate deploy`, `npm run prisma:generate`, then optionally `npm run seed`.
- Docker exposes PostgreSQL on `5432` and Redis on `6379`. The init script creates `somos-barrio-test` only when the PostgreSQL volume is first initialized.
- `src/app.ts` builds the Express app; `src/server.ts` connects services, listens, and shuts down. Integration tests import `app` without opening a port.
- API modules follow `src/modules/<name>/{routes,controller,schema,service}.ts`. All routes are assembled in `src/routes/index.ts` under `API_PREFIX` (normally `/api/v1`); most domain resources are nested under `/barrios/:barrioSlug`.
- The OpenAPI document is maintained manually in `src/lib/openapi.ts`. Keep it synchronized when changing routes, validation, request bodies, or responses; Swagger UI is served at `/api/docs`.
- `src/config/env.ts` validates environment variables at import time; use its `env` export rather than reading `process.env` in application code.
- After a Prisma schema change, run `npm run prisma:migrate -- --name <name>` and `npm run prisma:generate`; commit the migration under `prisma/migrations/`. CI deploys migrations rather than creating them.
- Keep both auth transports synchronized: `/auth/mobile/*` returns rotating refresh tokens in the body, while browser `/auth/*` uses httpOnly cookies.

## Backend Tests

- Unit tests exclude `*.integration.test.ts`: `npm test`. Focus one file with `npm test -- src/middlewares/validate.test.ts`.
- Copy `.env.test.example` to `.env.test` before `npm run test:integration`; focus a suite with `npm run test:integration -- src/modules/auth/auth.integration.test.ts`.
- Integration tests use real PostgreSQL and Redis, run serially, deploy migrations in global setup, and clear domain tables before each suite. The runtime guard accepts only the exact database name `somos-barrio-test`; never weaken it or point tests at development data.
- CI order is Prisma generate, typecheck, build, deploy main migrations, unit tests, create/deploy the test database, then integration tests. There is no backend lint script.

## Expo App

- Run from `app/` and read `app/AGENTS.md` before coding; it requires the versioned Expo SDK 54 documentation.
- Use `npm start`, `npm run android`, `npm run ios`, `npm run web`, and `npm run lint`. There is no test script or mobile CI job; use `npx tsc --noEmit` for a direct typecheck.
- Expo Router routes live under `app/app/`; `app/(auth)` and `app/(app)/(tabs)` are route groups. The authenticated layout currently has no auth guard, and `app/index.tsx` always redirects to login.
- The app has typed routes, the React Compiler, and the new architecture enabled. `@/*` resolves from the mobile package root; shared visual primitives use `components/Clay*.tsx` and `constants/ClayTheme.ts`.
- `EXPO_PUBLIC_API_URL` overrides the API base URL. Defaults are `10.0.2.2:4000/api/v1` on Android and `localhost:4000/api/v1` elsewhere; physical devices need the host LAN IP and a matching backend `CORS_ORIGIN`.
- Native auth uses `/auth/mobile/*`: the access token stays in memory in `lib/api.ts`, while only the rotating refresh token is persisted through `expo-secure-store` in `lib/auth.ts`.
