# Somos Barrio Agent Notes

## Repository Boundaries

- There is no root npm workspace. `Backend/` and `Frontend/` have independent `package-lock.json` files; run every npm command from the relevant directory.
- CI currently covers only `Backend/` (`.github/workflows/ci.yml`). Frontend changes need local `npm run lint` and `npm run build` verification.
- Use Node 20 or newer; CI uses Node 20 and the backend declares `>=20`.

## Backend

- `src/app.ts` builds the Express app; `src/server.ts` only connects services, listens, and shuts down. Integration tests import `app` without opening a port.
- API modules follow `src/modules/<name>/{routes,controller,schema,service}.ts`. All routes are assembled in `src/routes/index.ts` under `API_PREFIX` (normally `/api/v1`); most domain resources are nested under `/barrios/:barrioSlug`.
- The OpenAPI document is maintained manually in `src/lib/openapi.ts`. Keep it synchronized when changing routes, validation, request bodies, or responses; Swagger UI is served at `/api/docs`.
- Prisma schema and migrations live in `Backend/prisma/`. After a schema change, create a migration with `npm run prisma:migrate -- --name <name>` and regenerate with `npm run prisma:generate`; CI applies committed migrations with `prisma migrate deploy`.
- From a clean checkout: `npm ci`, copy `.env.example` to `.env`, `docker compose up -d`, `npx prisma migrate deploy`, `npm run prisma:generate`, then optionally `npm run seed`.
- Docker exposes PostgreSQL on `5434` and Redis on `6379`. The test database is `somos-barrio-test`; the init script creates it only when the PostgreSQL volume is first initialized.

## Backend Tests

- Unit tests exclude `*.integration.test.ts`: `npm test`. Focus one file with `npm test -- src/middlewares/validate.test.ts`.
- Integration tests use real PostgreSQL, run serially, apply migrations in global setup, and delete all domain rows before each suite. Never point them at the development database.
- Before integration tests, create `Backend/.env.test` with at least `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/somos-barrio-test?schema=public` and a `JWT_SECRET` of 16+ characters. Then run `npm run test:integration`; focus one file with `npm run test:integration -- src/modules/auth/auth.integration.test.ts`.
- Backend verification matching CI is: `npm run prisma:generate`, `npm run typecheck`, `npm test`, then `npm run test:integration` when PostgreSQL and Redis are available. There is no backend lint script.

## Frontend

- The React/Vite entry is `src/main.tsx`; routing and providers are centralized in `src/App.tsx`. API calls use the shared Axios client in `src/lib/api.ts` and service modules in `src/services/`.
- Vite proxies `/api` to `http://localhost:4000`; the Axios base URL is `/api/v1`. Vite defaults to port `5173`, while the backend example allows origin `http://localhost:3000`; set backend `CORS_ORIGIN=http://localhost:5173` when running both defaults.
- Auth persists only the user in Zustand. The access token stays in memory and `src/lib/api.ts` restores it through the httpOnly refresh-token cookie; preserve `withCredentials` and this refresh flow when changing auth.
- Frontend setup is `npm ci`; development is `npm run dev`. Verify with `npm run lint` followed by `npm run build`. No frontend test runner is configured.
