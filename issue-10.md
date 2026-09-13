# Issue #10 - Revision humana, reportes y apelaciones del marketplace

Issue: https://github.com/Facu-18/Somos-Barrio/issues/10

Rama objetivo: `develop`

## 1. Objetivo

Completar el circuito de moderacion humana del marketplace sobre la base implementada en las issues #9 y #4.

El resultado debe permitir:

- Revisar publicaciones pendientes, reportadas, rechazadas, removidas y apeladas.
- Revisar assets ambiguos que Sightengine dejo en cuarentena privada.
- Limitar a cada editor a su barrio y reservar el alcance global para administradores.
- Aplicar decisiones atomicas, idempotentes y seguras ante concurrencia.
- Conservar un historial append-only aunque el propietario elimine la publicacion.
- Permitir que el propietario vea una razon publica, corrija y apele.
- Mantener notas, evidencia, scores y URLs privadas fuera de respuestas publicas.

## 2. Criterios de aceptacion

- [ ] Dos decisiones concurrentes sobre la misma version aplican como maximo una transicion.
- [ ] Reintentar una operacion con la misma clave de idempotencia no crea otra decision.
- [ ] Un editor no puede listar ni moderar publicaciones, reportes, apelaciones o assets de otro barrio.
- [ ] Un usuario no puede reportar repetidamente la misma publicacion.
- [ ] El cruce concurrente del umbral de reportes genera una sola decision preventiva.
- [ ] Una publicacion removida desaparece inmediatamente de lista, detalle ajeno, busqueda, contacto y nuevas referencias desde mensajes.
- [ ] El propietario recibe una razon publica estable, pero nunca notas privadas ni evidencia interna.
- [ ] El propietario puede corregir y reenviar sin eliminar el historial anterior.
- [ ] El propietario puede crear una unica apelacion pendiente para contenido rechazado o removido.
- [ ] Aceptar o rechazar una apelacion agrega auditoria append-only.
- [ ] Restaurar una publicacion agrega una nueva decision y no modifica decisiones anteriores.
- [ ] Un asset en cuarentena nunca expone una URL publica.
- [ ] Un asset ambiguo puede revisarse sin perderse por el cleanup de huerfanos.
- [ ] Aprobar o rechazar un asset es recuperable ante fallos entre Cloudinary y PostgreSQL.
- [ ] Una publicacion no puede aprobarse mientras contenga assets pendientes o rechazados.
- [ ] OpenAPI documenta bandejas, estados, errores y DTOs publicos/internos.
- [ ] Backend typecheck, build, unit tests e integration tests pasan.
- [ ] App typecheck y lint pasan sin errores nuevos.

## 3. Estado actual

### 3.1 Ya implementado

- `MarketplacePost` separa `availability` de `moderationStatus`.
- Existen los estados `PENDING_REVIEW`, `APPROVED`, `REJECTED` y `REMOVED`.
- Existe historial basico en `MarketplaceModerationDecision`.
- Existe `MarketplaceReport` con unique por `postId + reporterId`.
- Existe `MarketplaceAsset` con ownership, scores, OCR, estado y referencia Cloudinary.
- Los assets ambiguos usan delivery `authenticated` y no entregan URL publica.
- Los assets aprobados son los unicos que pueden adjuntarse actualmente.
- La cola basica de moderacion restringe editores por barrio.
- Existen acciones basicas `APPROVE`, `REJECT`, `REMOVE` y `RESTORE`.
- El listado publico filtra `APPROVED + AVAILABLE`.
- Busqueda, reportes, contacto y mensajes nuevos verifican visibilidad.
- Las ediciones materiales vuelven a moderacion automatica/humana.
- La app tiene una cola administrativa basica y muestra estados generales al propietario.

### 3.2 Faltantes principales

- No existe compare-and-swap ni version de moderacion.
- La idempotencia actual depende del estado observado y falla bajo concurrencia.
- No existe una bandeja derivada `REPORTED`.
- El umbral de reportes esta fijo y su transaccion tiene una carrera.
- Los reportes no tienen estado ni resolucion.
- No existe modelo ni flujo de apelacion.
- La razon libre de una decision manual no llega al propietario.
- El borrado fisico elimina decisiones y reportes por cascade.
- No existe revision humana de assets.
- Los assets cuarentenados no pueden asociarse a una publicacion pendiente.
- El cleanup puede borrar una cuarentena antes de la revision humana.
- La UI administrativa no tiene bandejas, historial, assets, apelaciones ni manejo de conflictos.

## 4. Decisiones de arquitectura

### 4.1 Reutilizar el modulo de moderacion

Extender `Backend/src/modules/moderation/` en lugar de crear rutas paralelas en `admin/`.

Motivos:

- Ya contiene las verificaciones de rol y barrio.
- Ya centraliza la cola y las decisiones del marketplace.
- Evita dos contratos administrativos para el mismo dominio.

### 4.2 `REPORTED` y `APPEALED` son bandejas, no estados del post

Una publicacion puede estar aprobada y tener reportes abiertos. Tambien puede estar rechazada y tener una apelacion pendiente.

La cola aceptara:

```text
queue=PENDING_REVIEW|REPORTED|REJECTED|REMOVED|APPEALED
```

`REPORTED` se deriva de reportes abiertos. `APPEALED` se deriva de una apelacion pendiente.

### 4.3 Soft delete para preservar auditoria

Eliminar una publicacion debe establecer `deletedAt`, no borrar la fila.

Todos los endpoints publicos deben exigir `deletedAt IS NULL`. Moderacion puede consultar registros eliminados para auditoria.

### 4.4 Concurrencia mediante version y CAS

Cada publicacion y asset moderable tendra `moderationVersion`.

Las decisiones manuales deben recibir:

```json
{
  "decision": "APPROVE",
  "reasonCode": "POLICY_COMPLIANT",
  "privateNote": "Nota opcional para moderadores",
  "expectedVersion": 4,
  "idempotencyKey": "uuid"
}
```

El servicio actualizara solamente cuando la version almacenada coincida con `expectedVersion`. Un conflicto devolvera `409 MODERATION_VERSION_CONFLICT`.

### 4.5 DTOs separados por audiencia

Definir presentadores explicitos para:

- Respuesta publica.
- Respuesta del propietario.
- Respuesta interna de moderacion.

No usar spreads genericos para mover entidades Prisma completas a una respuesta.

### 4.6 Efectos externos durables

Cloudinary y PostgreSQL no comparten transaccion. La promocion o eliminacion de un asset debe usar estados operativos persistidos y un worker de reconciliacion.

## 5. Modelo de datos

Crear una migracion nueva. No modificar migraciones ya publicadas.

### 5.1 Enums propuestos

```prisma
enum MarketplaceModerationAction {
  AUTO_REVIEW
  REPORT_THRESHOLD
  APPROVE
  REJECT
  REMOVE
  RESTORE
  OWNER_RESUBMIT
  APPEAL_ACCEPT
  APPEAL_REJECT
}

enum MarketplaceReportStatus {
  OPEN
  RESOLVED
  DISMISSED
}

enum MarketplaceAppealStatus {
  PENDING
  ACCEPTED
  REJECTED
  SUPERSEDED
}

enum MarketplaceAssetModerationAction {
  APPROVE
  REJECT
}
```

Extender `MarketplaceAssetStatus` con estados operativos si Cloudinary requiere una operacion de varios pasos:

```prisma
PROMOTION_PENDING
REJECTION_PENDING
```

### 5.2 `MarketplacePost`

Agregar:

```prisma
moderationVersion Int       @default(0)
deletedAt         DateTime?
appeals           MarketplaceAppeal[]
```

Agregar indices para colas y soft delete:

```prisma
@@index([barrioId, deletedAt, moderationStatus, updatedAt])
```

### 5.3 `MarketplaceModerationDecision`

Agregar:

```prisma
action         MarketplaceModerationAction?
reasonCode     String?
fromStatus     ModerationStatus?
fromVersion    Int?
toVersion      Int?
idempotencyKey String?                      @unique
evidence       Json?
appealId       String?
```

Agregar una defensa adicional para una sola decision por version:

```prisma
@@unique([postId, toVersion])
@@index([postId, createdAt])
```

Los campos nuevos deben ser nullable para conservar decisiones historicas existentes.

### 5.4 `MarketplaceReport`

Agregar:

```prisma
status               MarketplaceReportStatus @default(OPEN)
resolvedAt           DateTime?
resolvedById         String?
resolutionDecisionId String?
```

Mantener `@@unique([postId, reporterId])`. Un usuario puede reportar una publicacion una sola vez durante toda su vida.

### 5.5 `MarketplaceAppeal`

Crear:

```prisma
model MarketplaceAppeal {
  id                   String                    @id @default(cuid())
  postId               String
  ownerId              String
  againstDecisionId    String?
  statement            String
  status               MarketplaceAppealStatus @default(PENDING)
  idempotencyKey       String                    @unique
  resolutionDecisionId String?
  resolvedById         String?
  resolvedAt           DateTime?
  createdAt            DateTime                  @default(now())
  updatedAt            DateTime                  @updatedAt
}
```

Crear en SQL un indice unico parcial que permita una sola apelacion pendiente por post:

```sql
CREATE UNIQUE INDEX "MarketplaceAppeal_one_pending_per_post"
ON "MarketplaceAppeal" ("postId")
WHERE "status" = 'PENDING';
```

### 5.6 `MarketplaceAsset`

Agregar:

```prisma
barrioId          String?
moderationVersion Int     @default(0)
reviewDecisions   MarketplaceAssetModerationDecision[]
```

`barrioId` se captura al subir o al asociar el asset por primera vez. Debe quedar inmutable despues de asociarse. Los assets historicos sin barrio solo pueden ser revisados por `ADMIN`.

Crear `MarketplaceAssetModerationDecision` con:

- `assetId`.
- `moderatorId`.
- `action`.
- `reasonCode`.
- `privateNote`.
- `fromStatus` y `toStatus`.
- `fromVersion` y `toVersion`.
- `idempotencyKey` unique.
- `policyVersion`.
- `evidence` sanitizada.
- `createdAt`.

## 6. Catalogo de razones

Usar codigos estables validados por Zod. La app traduce estos codigos a texto.

Catalogo inicial:

```text
POLICY_COMPLIANT
PROHIBITED_ITEM
REGULATED_ITEM
FRAUD_OR_MISLEADING
SPAM_OR_DUPLICATE
INAPPROPRIATE_CONTENT
IMAGE_POLICY
REPORT_REVIEW
CONTENT_CORRECTED
OTHER_POLICY
```

Reglas:

- `reasonCode` es visible para el propietario.
- `privateNote` solo aparece en endpoints de moderacion.
- `evidence` puede incluir hashes, categorias, cantidad de reportes y scores sanitizados.
- No guardar bytes ni OCR completo como evidencia.
- No mostrar scores, request IDs o reglas internas al propietario.

## 7. Transiciones permitidas

### 7.1 Publicaciones

| Accion | Estados origen | Estado destino | Condiciones |
| --- | --- | --- | --- |
| `APPROVE` | `PENDING_REVIEW`, `REJECTED` | `APPROVED` | Todos los assets aprobados; no autoaprobar |
| `REJECT` | `PENDING_REVIEW` | `REJECTED` | Razon publica obligatoria |
| `REMOVE` | `APPROVED`, `PENDING_REVIEW`, `REJECTED` | `REMOVED` | Razon publica obligatoria |
| `RESTORE` | `REMOVED` | `APPROVED` o `PENDING_REVIEW` | Assets validos y decision nueva |
| `OWNER_RESUBMIT` | `REJECTED`, `REMOVED`, `PENDING_REVIEW` | `PENDING_REVIEW` o `REJECTED` | Cambio material y moderacion automatica |
| `REPORT_THRESHOLD` | `APPROVED` | `PENDING_REVIEW` | Cruce atomico del umbral |

Si una apelacion es rechazada y el post permanece `REJECTED` o `REMOVED`, registrar la decision aunque no cambie el estado.

### 7.2 Assets

| Accion | Estado origen | Estado destino |
| --- | --- | --- |
| Aprobar | `QUARANTINED` | `PROMOTION_PENDING` -> `APPROVED` |
| Rechazar | `QUARANTINED` | `REJECTION_PENDING` -> `REJECTED` |

Una publicacion solo puede pasar a `APPROVED` cuando todos sus assets asociados estan `APPROVED`.

## 8. Flujos backend

### 8.1 Cola de moderacion

Extender:

```http
GET /api/v1/moderation/marketplace
```

Parametros:

```text
queue
barrioSlug
page
limit
```

Reglas:

- `EDITOR` ignora cualquier intento de ampliar el barrio y usa su `barrioId` real.
- `ADMIN` puede listar globalmente o filtrar por barrio.
- `REPORTED` incluye posts con al menos un reporte `OPEN`.
- `APPEALED` incluye posts con una apelacion `PENDING`.
- Validar `page >= 1` y `1 <= limit <= 50`.

Respuesta interna:

- Publicacion y `moderationVersion`.
- Propietario y barrio.
- Reportes abiertos.
- Apelacion pendiente.
- Historial de decisiones.
- Assets administrados y su estado.
- Nunca incluir tokens, cookies o datos del proveedor no necesarios.

### 8.2 Decision sobre una publicacion

Mantener:

```http
POST /api/v1/moderation/marketplace/{postId}/decision
```

Algoritmo:

1. Autenticar y recargar rol/barrio desde DB.
2. Buscar una decision previa por `idempotencyKey`.
3. Si existe y coincide con el mismo actor/payload, devolver el resultado guardado.
4. Validar barrio, autoaprobacion y matriz de transicion.
5. Validar que todos los assets permitan el estado destino.
6. Ejecutar `updateMany` por `id + moderationVersion + estado origen`.
7. Incrementar `moderationVersion`.
8. Exigir `count === 1`; si no, devolver `409 MODERATION_VERSION_CONFLICT`.
9. Crear la decision append-only con versiones anterior/nueva.
10. Resolver reportes o apelacion cuando corresponda.
11. Confirmar todo en una sola transaccion.

### 8.3 Reportar una publicacion

Mantener:

```http
POST /api/v1/barrios/{barrioSlug}/marketplace/{postId}/reports
```

Algoritmo transaccional:

1. Verificar que el post sea publico, no eliminado y no pertenezca al reporter.
2. Bloquear la fila del post con `SELECT ... FOR UPDATE`.
3. Crear el reporte `OPEN`.
4. Convertir el unique de reporter/post a `409 ALREADY_REPORTED`.
5. Contar reportes abiertos.
6. Si cruza el umbral y el post sigue aprobado, aplicar CAS.
7. Cambiar a `PENDING_REVIEW` y crear una unica decision `REPORT_THRESHOLD`.
8. Commit.

Agregar limiter por `req.user.id`. La constraint unique sigue siendo la defensa principal si Redis falla.

### 8.4 Apelar

Agregar:

```http
POST /api/v1/barrios/{barrioSlug}/marketplace/{postId}/appeals
```

Body:

```json
{
  "statement": "Explicacion del propietario",
  "expectedVersion": 3,
  "idempotencyKey": "uuid"
}
```

Reglas:

- Solo el propietario.
- Solo `REJECTED` o `REMOVED`.
- Una apelacion pendiente por post.
- Texto entre 20 y 2000 caracteres.
- El post no vuelve a ser publico por crear la apelacion.
- La apelacion aparece en la bandeja `APPEALED`.

### 8.5 Corregir y reenviar

Extender el PATCH existente con `expectedVersion`.

Una edicion material debe:

1. Aplicar CAS sobre la version esperada.
2. Ejecutar moderacion automatica nuevamente.
3. Incrementar version.
4. Crear decision `OWNER_RESUBMIT`.
5. Marcar una apelacion pendiente como `SUPERSEDED`.
6. Mantener intactas todas las decisiones anteriores.

### 8.6 Soft delete

El DELETE existente debe:

1. Aplicar CAS si se incorpora `expectedVersion` al contrato.
2. Establecer `deletedAt`.
3. Incrementar `moderationVersion`.
4. Desprender assets y marcarlos `DELETE_PENDING`.
5. Conservar post, decisiones, reportes y apelaciones.
6. Ejecutar cleanup best-effort y dejar retry durable.

## 9. Revision humana de assets

### 9.1 Asociar cuarentena a un post

Modificar el contrato de marketplace para aceptar assets propios en estado `APPROVED` o `QUARANTINED`.

Reglas:

- Un asset `QUARANTINED` fuerza el post a `PENDING_REVIEW`.
- El propietario recibe ID y estado, pero no URL privada.
- El publico recibe solamente URLs de assets aprobados.
- La app debe usar un arreglo tipado de assets; no emparejar `images[]` y `assetIds[]` por indice.

### 9.2 Cola de assets

Agregar:

```http
GET /api/v1/moderation/marketplace/assets?status=QUARANTINED&page=1&limit=20
```

Reglas:

- Editor: assets de su barrio.
- Admin: global o barrio filtrado.
- Asset historico sin barrio: solo admin.
- El backend genera un preview firmado de corta duracion para delivery `authenticated`.
- El preview no se persiste en DB.

### 9.3 Decision sobre un asset

Agregar:

```http
POST /api/v1/moderation/marketplace/assets/{assetId}/decision
```

Body:

```json
{
  "decision": "APPROVE",
  "reasonCode": "POLICY_COMPLIANT",
  "privateNote": "Revision visual manual",
  "expectedVersion": 1,
  "idempotencyKey": "uuid"
}
```

### 9.4 Aprobacion Cloudinary

Antes de implementar, confirmar en staging que la version instalada de Cloudinary soporta promocion `authenticated` a `upload` mediante rename/cambio de delivery type.

Flujo:

1. CAS `QUARANTINED -> PROMOTION_PENDING`.
2. Persistir la operacion y decision pendiente.
3. Promover o copiar el recurso a delivery publico.
4. Guardar nuevo `publicId`, tipo y `secure_url`.
5. Finalizar en `APPROVED` e incrementar version.
6. Eliminar el recurso privado anterior si la promocion genero una copia.
7. Recalcular si el post asociado puede ser aprobado.

Si la promocion directa no esta disponible, usar una copia server-side controlada y borrar el original autenticado. Nunca descargar bytes al cliente.

### 9.5 Rechazo Cloudinary

Flujo:

1. CAS `QUARANTINED -> REJECTION_PENDING`.
2. Destruir el recurso `authenticated` con invalidacion.
3. Tratar `not found` como exito idempotente.
4. Limpiar URL, public ID y tipo de delivery.
5. Finalizar en `REJECTED`.
6. Conservar metadata y decision sin conservar bytes.
7. Mantener el post asociado fuera de superficies publicas.

### 9.6 Reconciliacion

Extender el worker actual para procesar:

- `PROMOTION_PENDING`.
- `REJECTION_PENDING`.
- `DELETE_PENDING`.

Separar el TTL de uploads abandonados del TTL de cuarentena humana. Una cuarentena asociada o pendiente de revision no debe eliminarse por el cleanup comun.

## 10. Configuracion

Agregar y validar:

```env
MARKETPLACE_REPORT_THRESHOLD=3
MARKETPLACE_REPORT_WINDOW_MS=3600000
MARKETPLACE_REPORT_USER_LIMIT=10
MARKETPLACE_APPEAL_USER_LIMIT=5
MARKETPLACE_ASSET_REVIEW_URL_TTL_SECONDS=300
MARKETPLACE_ASSET_REVIEW_TTL_MS=604800000
```

Actualizar:

- `Backend/src/config/env.ts`.
- `Backend/src/config/env.test.ts`.
- `Backend/.env.example`.
- `Backend/.env.test.example`.

## 11. OpenAPI

Actualizar `Backend/src/lib/openapi.ts` con:

- Query `queue` y paginacion validada.
- DTO publico de marketplace.
- DTO del propietario.
- DTO interno de moderacion.
- Reportes abiertos y su resolucion.
- Apelacion y estados.
- Decision de post con `expectedVersion` e `idempotencyKey`.
- Cola y decision de assets.
- Razones publicas permitidas.
- Errores `400`, `401`, `403`, `404`, `409`, `422`, `429`, `502` y `503` segun ruta.
- Codigo `MODERATION_VERSION_CONFLICT`.
- Codigo `ALREADY_REPORTED`.
- Codigo `APPEAL_ALREADY_PENDING`.
- Garantia de que campos internos no existen en DTOs publicos.

## 12. App movil

Antes de editar APIs Expo, consultar la documentacion exacta de SDK 54 indicada en `app/AGENTS.md`.

### 12.1 Tipos compartidos

Extender `app/types/api.ts` con:

- `MarketplacePost` publico.
- `MarketplaceOwnerPost`.
- `MarketplaceManagedAsset`.
- `MarketplaceModerationQueueItem`.
- `MarketplaceModerationDecision`.
- `MarketplaceReport` interno.
- `MarketplaceAppeal`.
- `MarketplaceReasonCode`.
- `ApiErrorResponse` con codigos estables.

Eliminar `any` en los flujos modificados.

### 12.2 Cola administrativa

Actualizar `app/app/(app)/admin-market-queue.tsx`:

- Tabs para pendientes, reportados, rechazados, removidos, apelados y assets.
- Paginacion e infinite scroll o boton de cargar mas.
- Pull-to-refresh.
- Filtro por barrio para admin.
- Historial de decisiones.
- Reportes abiertos y apelacion pendiente.
- Preview firmado de assets.
- Acciones aprobar, rechazar, remover y restaurar.
- Razon publica obligatoria y nota privada opcional.
- `expectedVersion` e `idempotencyKey` por accion.
- Manejo de `409` recargando el item.
- Deshabilitar botones durante la mutacion.

Una sola pantalla con tabs es preferible a varias rutas nuevas mientras el volumen sea bajo.

### 12.3 Detalle de marketplace

Actualizar `app/app/(app)/market/[id].tsx`:

- Mostrar razon publica al propietario.
- Mostrar estado de apelacion.
- Boton de reportar con manejo de duplicado y rate limit.
- Boton de corregir para el propietario.
- Boton de apelar para `REJECTED` o `REMOVED`.
- Invalidar lista y detalle despues de un reporte que oculte la publicacion.
- No mostrar notas privadas ni evidencia.

### 12.4 Mis publicaciones

Actualizar `app/app/(app)/my-posts.tsx`:

- Estado y razon publica.
- Estado de assets y apelacion.
- Acciones separadas para ver, corregir y apelar.
- Paginacion real.
- Mensaje vacio aplicable a todos los estados.

### 12.5 Crear y editar

Actualizar `app/app/(app)/create-market.tsx`:

- Conservar assets cuarentenados en el payload.
- Representar cada asset mediante ID, estado y preview local/publico.
- No depender del indice entre `images` y `assetIds`.
- Mostrar que una publicacion con imagen ambigua quedara en revision.
- Enviar `expectedVersion` al editar.
- Manejar conflicto `409` con recarga explicita.

## 13. Archivos backend

### 13.1 Modificar

- `Backend/prisma/schema.prisma`.
- `Backend/prisma/seed.ts`.
- `Backend/src/config/env.ts`.
- `Backend/src/config/env.test.ts`.
- `Backend/src/middlewares/rate-limit.ts`.
- `Backend/src/modules/marketplace/marketplace.routes.ts`.
- `Backend/src/modules/marketplace/marketplace.controller.ts`.
- `Backend/src/modules/marketplace/marketplace.schema.ts`.
- `Backend/src/modules/marketplace/marketplace.service.ts`.
- `Backend/src/modules/moderation/moderation.routes.ts`.
- `Backend/src/modules/moderation/moderation.controller.ts`.
- `Backend/src/modules/moderation/moderation.schema.ts`.
- `Backend/src/modules/moderation/moderation.service.ts`.
- `Backend/src/modules/upload/marketplace-asset.service.ts`.
- `Backend/src/modules/upload/marketplace-asset.cleanup.ts`.
- `Backend/src/lib/openapi.ts`.
- `Backend/src/test/setup.ts`.
- `Backend/.env.example`.
- `Backend/.env.test.example`.

### 13.2 Agregar

- `Backend/prisma/migrations/<timestamp>_marketplace_human_review/migration.sql`.
- `Backend/src/modules/moderation/marketplace-asset-review.service.ts` si el servicio principal crece demasiado.
- `Backend/src/modules/moderation/moderation.service.test.ts`.
- `Backend/src/modules/moderation/moderation.integration.test.ts`.

### 13.3 Ampliar tests existentes

- `Backend/src/modules/marketplace/marketplace.integration.test.ts`.
- `Backend/src/modules/marketplace/marketplace.service.test.ts`.
- `Backend/src/modules/upload/marketplace-asset.service.test.ts`.
- `Backend/src/modules/upload/marketplace-asset.cleanup.test.ts`.
- `Backend/src/modules/search/search.integration.test.ts`.
- `Backend/src/modules/messages/messages.integration.test.ts`.

## 14. Matriz de pruebas

### 14.1 Autorizacion

- [ ] Vecino recibe `403` en todas las rutas de moderacion.
- [ ] Editor lista y decide solamente dentro de su barrio.
- [ ] Editor no puede ampliar alcance enviando otro `barrioSlug`.
- [ ] Editor sin barrio recibe `403`.
- [ ] Admin puede listar globalmente y filtrar.
- [ ] Moderador no puede aprobar su propia publicacion.

### 14.2 Concurrencia e idempotencia

- [ ] Dos aprobaciones sobre la misma version: una aplica y otra devuelve `409`.
- [ ] Dos decisiones opuestas sobre la misma version: solo una aplica.
- [ ] Retry con la misma clave devuelve el mismo resultado.
- [ ] Reutilizar una clave con otro payload devuelve conflicto.
- [ ] Unique `postId + toVersion` impide decisiones duplicadas.
- [ ] Restaurar agrega una nueva decision.

### 14.3 Reportes

- [ ] Autorreporte rechazado.
- [ ] Segundo reporte del mismo usuario devuelve `409`.
- [ ] Reportes duplicados concurrentes crean una fila.
- [ ] Usuarios distintos pueden reportar.
- [ ] Debajo del umbral el post sigue publico y aparece en `REPORTED`.
- [ ] El cruce concurrente del umbral crea una decision.
- [ ] Al alcanzar el umbral desaparece de superficies publicas.
- [ ] Resolver reportes los elimina de la bandeja derivada.
- [ ] Rate limit devuelve `429`.

### 14.4 Apelaciones y correcciones

- [ ] Solo el propietario puede apelar.
- [ ] Solo se apela contenido rechazado o removido.
- [ ] Solo existe una apelacion pendiente por post.
- [ ] Retry idempotente no duplica apelaciones.
- [ ] Editor de otro barrio no ve la apelacion.
- [ ] Aceptar agrega decision de restauracion.
- [ ] Rechazar conserva estado y agrega auditoria.
- [ ] Corregir vuelve a revision y conserva decisiones.
- [ ] Corregir marca la apelacion abierta como `SUPERSEDED`.
- [ ] Correccion concurrente con moderacion devuelve conflicto.

### 14.5 Assets

- [ ] Asset cuarentenado puede adjuntarse sin publicar el post.
- [ ] Cola de assets respeta barrio.
- [ ] Preview firmado requiere moderador autorizado.
- [ ] URL privada no aparece en DTO publico o propietario.
- [ ] Dos aprobaciones concurrentes promocionan una vez.
- [ ] Aprobacion cambia delivery privado a publico.
- [ ] Rechazo elimina bytes y conserva auditoria.
- [ ] Repetir rechazo con recurso inexistente es idempotente.
- [ ] Fallos intermedios son recuperados por el worker.
- [ ] Cleanup no elimina una cuarentena humana activa.
- [ ] Post con asset pendiente/rechazado no puede aprobarse.

### 14.6 Visibilidad y auditoria

- [ ] Soft delete oculta inmediatamente el post.
- [ ] Las decisiones sobreviven al delete del propietario.
- [ ] Los reportes y apelaciones siguen disponibles para auditoria.
- [ ] Lista, detalle, busqueda, contacto y mensajes respetan `deletedAt` y moderacion.
- [ ] DTO publico no contiene `privateNote`, `evidence`, reporter email, scores, OCR o public ID.
- [ ] DTO del propietario contiene solamente razon publica y estado de apelacion/assets.

## 15. Orden de implementacion

### Fase 1 - Contratos y persistencia

- Cerrar enums, razones publicas y matriz de transiciones.
- Confirmar promocion Cloudinary en staging.
- Crear schema Prisma, migracion y backfills.
- Actualizar generacion de Prisma y setup de tests.

### Fase 2 - Moderacion concurrente

- Implementar CAS, idempotencia y DTOs explicitos.
- Completar bandejas de publicaciones.
- Corregir resolucion concurrente de reportes.
- Implementar soft delete.

### Fase 3 - Apelaciones

- Agregar creacion, cola y resolucion.
- Integrar correccion/reenvio con apelaciones pendientes.
- Exponer razon publica al propietario.

### Fase 4 - Assets

- Permitir asociar cuarentenas.
- Implementar cola, preview y decisiones.
- Implementar promocion/rechazo Cloudinary.
- Extender reconciliacion y cleanup.

### Fase 5 - OpenAPI y app

- Publicar contratos backend definitivos.
- Agregar tipos compartidos en la app.
- Completar cola administrativa, detalle, mis posts y editor.
- Manejar conflictos y rate limits.

### Fase 6 - Verificacion

- Ejecutar unit e integration tests completos.
- Ejecutar pruebas concurrentes contra PostgreSQL real.
- Probar Cloudinary en staging.
- Revisar filtraciones de DTOs y logs.
- Validar app en mobile y web.

## 16. Estrategia de commits

1. `feat: add marketplace review persistence`
2. `feat: make marketplace moderation idempotent`
3. `feat: add marketplace appeals and report queues`
4. `feat: add human review for marketplace assets`
5. `feat: complete marketplace moderation UI`
6. `test: cover marketplace moderation concurrency`

Cada commit debe dejar typecheck y tests focalizados en verde.

## 17. Rollout

1. Desplegar primero la migracion aditiva.
2. Desplegar backend compatible con clientes existentes.
3. Activar nuevas colas y decisiones.
4. Verificar manualmente promocion y rechazo en Cloudinary de staging.
5. Desplegar la app con los nuevos contratos.
6. Monitorear conflictos, reportes abiertos, cuarentenas y operaciones pendientes.
7. Retirar compatibilidad temporal solamente despues de confirmar adopcion del cliente nuevo.

No habilitar publicacion automatica de cuarentenas durante el rollout.

## 18. Riesgos y mitigaciones

| Riesgo | Mitigacion |
| --- | --- |
| Cloudinary cambia fuera de una transaccion DB | Estados pendientes y worker de reconciliacion |
| Dos moderadores actuan al mismo tiempo | CAS, version e idempotency key |
| Reportes concurrentes omiten o duplican el umbral | Lock de fila y decision unique por version |
| Un spread filtra datos internos | DTOs explicitos por audiencia |
| Cleanup borra evidencia pendiente | TTL separado y exclusion de cuarentena humana |
| Soft delete no se aplica en una consulta | Tests cruzados de lista, detalle, busqueda y mensajes |
| Una apelacion infla trabajo de moderacion | Una pendiente por post y rate limit |
| Cuentas multiples inflan reportes | Fuera del unique; monitorear y dejar reputacion/Sybil para una mejora posterior |
| Assets historicos no tienen barrio | Revision solo por admin hasta completar backfill confiable |
| App y backend se despliegan en distinto momento | Migracion y backend primero; compatibilidad temporal documentada |

## 19. Verificacion tecnica

Desde `Backend/`:

```powershell
npm run prisma:generate
npx prisma validate
npm run typecheck
npm run build
npm test
```

Con PostgreSQL y Redis de test disponibles:

```powershell
npm run test:integration -- src/modules/moderation/moderation.integration.test.ts
npm run test:integration -- src/modules/marketplace/marketplace.integration.test.ts
npm run test:integration -- src/modules/search/search.integration.test.ts
npm run test:integration -- src/modules/messages/messages.integration.test.ts
```

Desde `app/`:

```powershell
npx tsc --noEmit
npm run lint
```

Pruebas manuales de staging:

- Promocionar un asset `authenticated` y verificar que solo la URL publica final sea accesible.
- Rechazar un asset y verificar eliminacion del recurso privado.
- Interrumpir el proceso entre Cloudinary y DB y verificar reconciliacion.
- Intentar abrir una cuarentena sin URL firmada.
- Resolver dos veces la misma publicacion desde dos sesiones.
- Reportar concurrentemente hasta cruzar el umbral.
- Apelar, rechazar y luego corregir sin perder historial.

## 20. Definicion de terminado

La issue puede cerrarse cuando:

- Todos los criterios de la seccion 2 estan demostrados por tests o evidencia de staging.
- La migracion esta commiteada y se aplica sobre una base con datos existentes.
- No hay decisiones duplicadas bajo concurrencia.
- No hay contenido removido o eliminado en superficies publicas.
- No hay assets en cuarentena con URL publica.
- Las operaciones Cloudinary pendientes se recuperan automaticamente.
- El propietario puede ver razon, corregir y apelar.
- El moderador puede trabajar todas las bandejas y revisar assets.
- El historial permanece append-only.
- OpenAPI y la app usan el mismo contrato.
- Backend unit tests, integration tests, typecheck y build pasan.
- App typecheck y lint pasan sin errores nuevos.
