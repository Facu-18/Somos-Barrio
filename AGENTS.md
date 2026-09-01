# Somos Barrio Agent Notes

## Repository Boundaries

- There is no root npm workspace. The current application is `Backend/`; the removed web frontend must not be restored. A future Expo app should be a separate `Mobile/` package with its own lockfile.
- CI covers `Backend/` (`.github/workflows/ci.yml`) and verifies Prisma generation, typecheck, production build, unit tests, migrations, and integration tests.
- Use Node 20 or newer; CI uses Node 20 and the backend declares `>=20`.

## Backend

- `src/app.ts` builds the Express app; `src/server.ts` only connects services, listens, and shuts down. Integration tests import `app` without opening a port.
- API modules follow `src/modules/<name>/{routes,controller,schema,service}.ts`. All routes are assembled in `src/routes/index.ts` under `API_PREFIX` (normally `/api/v1`); most domain resources are nested under `/barrios/:barrioSlug`.
- The OpenAPI document is maintained manually in `src/lib/openapi.ts`. Keep it synchronized when changing routes, validation, request bodies, or responses; Swagger UI is served at `/api/docs`.
- Prisma schema and migrations live in `Backend/prisma/`. After a schema change, create a migration with `npm run prisma:migrate -- --name <name>` and regenerate with `npm run prisma:generate`; CI applies committed migrations with `prisma migrate deploy`.
- From a clean checkout: `npm ci`, copy `.env.example` to `.env`, `docker compose up -d`, `npx prisma migrate deploy`, `npm run prisma:generate`, then optionally `npm run seed`. Production build emits `dist/server.js` and starts with `npm start`.
- Docker exposes PostgreSQL on `5434` and Redis on `6379`. The test database is `somos-barrio-test`; the init script creates it only when the PostgreSQL volume is first initialized.
- Native clients use `/auth/mobile/*`, receive the rotating refresh token in the response body, and must store it in platform secure storage. Browser `/auth/*` endpoints retain the httpOnly-cookie flow.

## Backend Tests

- Unit tests exclude `*.integration.test.ts`: `npm test`. Focus one file with `npm test -- src/middlewares/validate.test.ts`.
- Integration tests use real PostgreSQL, run serially, apply migrations in global setup, and delete all domain rows before each suite. Never point them at the development database.
- Copy `.env.test.example` to `.env.test` before integration tests. Runtime guards reject every database name except exactly `somos-barrio-test`; do not weaken this check.
- Backend verification matching CI is: `npm run prisma:generate`, `npm run typecheck`, `npm test`, `npm run build`, then `npm run test:integration` when PostgreSQL and Redis are available. There is no backend lint script.
