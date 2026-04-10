# Somos Barrio Backend

Backend inicial para la Revista Barrial Digital construido con:

- Node.js + Express + TypeScript
- PostgreSQL + Prisma
- Redis (rate limiting y cache futuro)
- JWT para autenticacion

## 1) Configuracion rapida

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run seed
npm run dev
```

## 2) Endpoints iniciales

- `GET /` saludo base
- `GET /api/v1/health` healthcheck
- `POST /api/v1/auth/register` registro de vecino
- `POST /api/v1/auth/login` login con email/password
- `GET /api/v1/auth/me` usuario autenticado (`Authorization: Bearer <token>`)

## 3) Estructura

```text
prisma/
  schema.prisma
  seed.ts
src/
  config/
  lib/
  middlewares/
  modules/
    auth/
    health/
  routes/
  utils/
```

## 4) Proximo paso recomendado

1. Agregar refresh tokens rotativos en Redis.
2. Crear modulo `news` con permisos `EDITOR/ADMIN`.
3. Crear modulo `business-directory`.
4. Crear modulo `marketplace` con limite de publicaciones free.
