# Somos Barrio API

API de la plataforma móvil Somos Barrio. Usa Node.js 20, Express, TypeScript, PostgreSQL, Prisma y Redis.

## Desarrollo local

```bash
npm ci
cp .env.example .env
docker compose up -d
npx prisma migrate deploy
npm run prisma:generate
npm run seed
npm run dev
```

La API queda en `http://localhost:4000/api/v1` y Swagger UI en `http://localhost:4000/api/docs`.

Servicios locales:

- PostgreSQL: `localhost:5432`, base `somos-barrio`.
- Redis: `localhost:6379`.
- Expo suele usar `http://localhost:8081` como origen web. `CORS_ORIGIN` acepta una lista separada por comas.
- Un dispositivo físico debe usar la IP LAN del equipo, no `localhost`.

## Autenticación móvil

La app nativa debe usar estos endpoints:

- `POST /auth/mobile/register`
- `POST /auth/mobile/login`
- `POST /auth/mobile/refresh`
- `POST /auth/mobile/logout`
- `GET /auth/me`

Login y registro devuelven `{ user, accessToken, refreshToken }`. Guardar `refreshToken` en almacenamiento seguro del dispositivo y mantener `accessToken` en memoria. Refresh rota el token de manera atómica: un token consumido no puede reutilizarse.

Los endpoints `/auth/register`, `/auth/login`, `/auth/refresh` y `/auth/logout` conservan el transporte por cookie httpOnly para clientes web.

## Verificación

```bash
npm run prisma:generate
npm run typecheck
npm test
npm run build
```

El build de producción genera `dist/server.js`; se inicia con `npm start`.

## Tests de integración

```bash
cp .env.test.example .env.test
npm run test:integration
```

La suite usa PostgreSQL y Redis reales, corre en serie y elimina los datos de dominio. Existe una protección que bloquea la ejecución salvo que `DATABASE_URL` apunte exactamente a `somos-barrio-test`.

Para ejecutar una sola suite:

```bash
npm run test:integration -- src/modules/auth/auth.integration.test.ts
```

## Prisma y contrato

- Cambios de schema: `npm run prisma:migrate -- --name <nombre>` y luego `npm run prisma:generate`.
- CI aplica las migraciones con `prisma migrate deploy`.
- El contrato OpenAPI se mantiene en `src/lib/openapi.ts`; debe cambiar junto con rutas, schemas, DTOs y códigos de respuesta.
- Health: `/health/live` comprueba el proceso y `/health/ready` comprueba PostgreSQL y Redis.
