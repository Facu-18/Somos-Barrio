# Panel web de Somos Barrio

Panel administrativo construido con Next.js 16. El navegador consume la API mediante `/api/v1`; Next.js reenvía esas solicitudes al backend para mantener cookies y autenticación en el mismo origen.

## Requisitos

- Node.js 20 o superior.
- Backend de Somos Barrio en ejecución.

## Configuración

Creá `web/.env.local` a partir de `web/.env.example` y configurá:

```env
BACKEND_URL=http://localhost:4000
```

`BACKEND_URL` debe contener únicamente el origen del backend, sin `/api/v1` ni una barra final. Es una variable privada del servidor de Next.js y no debe usar el prefijo `NEXT_PUBLIC_`.

Si no se define, el panel utiliza `http://localhost:4000`.

## Desarrollo

Desde `web/`:

```bash
npm ci
npm run dev
```

El panel queda disponible en [http://localhost:3000](http://localhost:3000).

## Verificación

```bash
npm run lint
npx tsc --noEmit
npm run build
```
