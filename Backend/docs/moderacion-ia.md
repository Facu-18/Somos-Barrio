# Moderación e IA: operación y políticas

Guía operativa de la moderación de contenido (marketplace, foro, imágenes) y de la asistencia con IA en noticias. Explica qué decide cada capa, cómo rastrear una decisión, cómo medir y alertar, y qué hacer ante incidentes.

- [1. Capas de defensa](#1-capas-de-defensa)
- [2. Catálogo de políticas](#2-catálogo-de-políticas)
- [3. Versionado y trazabilidad](#3-versionado-y-trazabilidad)
- [4. Umbrales y configuración](#4-umbrales-y-configuración)
- [5. Shadow mode](#5-shadow-mode)
- [6. Métricas y alertas](#6-métricas-y-alertas)
- [7. Runbook](#7-runbook)
- [8. Escalamiento](#8-escalamiento)
- [9. Retención](#9-retención)
- [10. Rollback](#10-rollback)
- [11. Pruebas y CI](#11-pruebas-y-ci)

## 1. Capas de defensa

| Capa | Dónde | Qué hace |
|---|---|---|
| Política de texto `es-AR` | `src/modules/content-moderation/` | Normaliza el texto (NFKC, tildes, Unicode invisible, bidi, homoglifos, leetspeak, separadores) y decide `ALLOW`, `REVIEW` o `BLOCK`. Se aplica a marketplace, foro y OCR de imágenes. |
| Imágenes (Sightengine) | `content-moderation/sightengine.provider.ts`, `upload/marketplace-asset.service.ts` | Puntajes por categoría contra umbrales `review`/`block`; el OCR pasa por la política de texto. Las imágenes ambiguas quedan en cuarentena privada. |
| Revisión humana | `src/modules/moderation/` | Colas por barrio, reportes con umbral, apelaciones y decisiones append-only. |
| Guard de prompt injection | `news/prompt-injection.guard.ts` | Rechaza cambios de rol, revelación del prompt e instrucciones ofuscadas antes de llamar al proveedor. |
| Contrato del proveedor de IA | `news/ai.provider.ts` | Instrucciones solo en `system`, datos como JSON delimitado, sin tools, salida con JSON Schema estricto. |
| Límites de IA | `news/ai.limiter.ts` | Cuota diaria, un pedido en curso por usuario, concurrencia global, presupuesto de tokens, caché y single-flight en Redis. Falla cerrado. |

El contenido `PENDING_REVIEW`, `BLOCKED`/`REJECTED` o `REMOVED` nunca aparece en listados, detalle público, conteos, búsqueda ni notificaciones push.

## 2. Catálogo de políticas

### Política de texto `es-AR-1.1`

Definida en `src/modules/content-moderation/policies/es-AR.ts`. `BLOCK` gana siempre; si hay varias reglas `REVIEW`, la primera identifica la decisión y las categorías se acumulan.

| Regla | Decisión | Dominio | Categoría | Detecta |
|---|---|---|---|---|
| `AR-WPN-1..3` | BLOCK | Marketplace | WEAPONS | "pistola", "revolver", "municiones" (token exacto) |
| `AR-DRG-1`, `AR-DRG-2` | BLOCK | Marketplace | DRUGS | "marihuana", "cocaina" incluso con separadores |
| `AR-DRG-3`, `AR-DRG-4` | REVIEW | Marketplace | DRUGS | Variantes aproximadas (distancia de edición ≤ 2) |
| `AR-THR-1`, `AR-THR-2` | BLOCK | Todos | THREAT | Amenazas literales ("te voy a matar", "te pego un tiro") |
| `AR-THR-3` | REVIEW | Todos | THREAT | Amenazas ofuscadas |
| `AR-INS-G1` | BLOCK | Todos | INSULT | Insultos graves literales |
| `AR-INS-G2`, `AR-INS-G3` | REVIEW | Todos | INSULT | Insultos graves ofuscados, "hdp" |
| `AR-DIS-1` | BLOCK | Todos | DISCRIMINATION | "<grupo> de mierda" literal |
| `AR-DIS-2` | REVIEW | Todos | DISCRIMINATION | Variante ofuscada |
| `AR-INS-1..4` | REVIEW | Todos | INSULT | Insultos comunes |

Allowlist: `madrugada`, `analisis`, `documento`, `armario`, `repuesto`, `cocina`, `medicamento`.

Las armas y drogas solo bloquean en el marketplace: en el foro los vecinos las mencionan para denunciar hechos. Limitación conocida: `AR-WPN-1` bloquea usos legítimos como "pistola de silicona" (hay un test que lo documenta).

### Revisión humana

| Dominio | Transiciones | Versión |
|---|---|---|
| Marketplace | APPROVE, REJECT, REMOVE, RESTORE; apelaciones ACCEPT/REJECT; ocultamiento por `MARKETPLACE_REPORT_THRESHOLD` | `marketplace-review-2`, imágenes `marketplace-asset-review-1` |
| Foro | APPROVE, BLOCK, REMOVE, RESTORE, DISMISS_REPORTS; apelaciones; ocultamiento por `FORUM_REPORT_THRESHOLD` | `forum-review-1` |

Nadie puede publicar su propio contenido. Una corrección limpia del autor no deshace una retención decidida por moderación o reportes: vuelve a revisión.

### Asistencia con IA

| Elemento | Valor |
|---|---|
| Versión de prompt | `NEWS_PROMPT_VERSION = news-editor-2` (`news/ai.provider.ts`) |
| Límites de entrada | Título 255, descripción 500, cuerpo 12.000 caracteres, 48 KB, `AI_MAX_INPUT_TOKENS` estimados |
| Salida | JSON Schema estricto, `finish_reason = stop`, sin claves extra |
| Guard | Reglas `IGNORE_INSTRUCTIONS`, `ROLE_CHANGE`, `PROMPT_REVEAL`, `ROLE_MARKER`, `CHAT_TEMPLATE_TOKEN`, `OBFUSCATED_*`, entre otras |

## 3. Versionado y trazabilidad

Cada decisión guarda con qué regla y versión se tomó, sin secretos ni contenido del proveedor:

| Registro | Campos |
|---|---|
| `ForumModerationDecision` | `action`, `fromStatus`/`toStatus`, `fromVersion`/`toVersion`, `ruleId`, `policyVersion`, `contentHash`, `actorId`, `reasonCode`, `evidence` (p. ej. `shadowRuleIds`) |
| `MarketplaceModerationDecision` | `action`, `status`, `ruleId`, `ruleVersion`, `policyVersion`, `contentHash`, `moderatorId`, `evidence` |
| `MarketplaceAssetModerationDecision` | `action`, `policyVersion`, `reasonCode`, `moderatorId` |
| `NewsAiGeneration` | `promptVersion`, `model`, `provider`, `finishReason`, `sourceHash`, tokens, duración, costo estimado, `cached`, `appliedById` |

Reglas de versionado:

- **Cambiar reglas o allowlist** de `es-AR.ts`: subir la versión en `content-moderation.service.ts` (`es-AR-1.1` → `es-AR-1.2`).
- **Cambiar prompts, esquemas o límites de salida de IA**: subir `NEWS_PROMPT_VERSION`. Forma parte de la clave de caché, así que invalida resultados viejos.
- **Cambiar transiciones de revisión humana**: subir la versión correspondiente (`forum-review-N`, `marketplace-review-N`).

Rastrear una decisión (solo lectura):

```sql
-- Historial de un hilo o respuesta del foro
SELECT "toVersion", action, "toStatus", "ruleId", "policyVersion", "reasonCode", "actorId", evidence, "createdAt"
FROM "ForumModerationDecision" WHERE "threadId" = '<id>' OR "replyId" = '<id>' ORDER BY "toVersion";

-- Con qué prompt y modelo se generó un resumen publicado
SELECT n.slug, g."promptVersion", g.model, g."finishReason", g."appliedById"
FROM "News" n JOIN "NewsAiGeneration" g ON g.id = n."aiSummary"->>'generationId' WHERE n.slug = '<slug>';
```

Cada request tiene un `X-Request-Id`: un UUID o un id opaco validado que envía el cliente, nunca datos personales. Se devuelve en la respuesta, aparece como `requestId` en todos los logs y se envía al proveedor de IA. Los logs redactan tokens, cookies, emails, teléfonos y credenciales (`src/config/logger.ts`).

## 4. Umbrales y configuración

Todas las variables se validan en `src/config/env.ts`. **Cambiarlas requiere reiniciar el proceso.**

| Variable | Default | Efecto |
|---|---|---|
| `AI_ENABLED` | `true` | Corte de emergencia de toda la IA |
| `AI_DAILY_USER_LIMIT` | `3` | Generaciones diarias por usuario |
| `AI_GLOBAL_DAILY_TOKEN_BUDGET` | `0` (sin límite) | Tokens diarios reservados antes de cada llamada |
| `AI_MAX_CONCURRENCY` | `10` | Generaciones simultáneas en todo el sistema |
| `AI_CACHE_TTL_SECONDS` | `86400` | Vida de la caché de sugerencias |
| `AI_MAX_INPUT_TOKENS` / `AI_MAX_OUTPUT_TOKENS` | `4000` / `6000` | Presupuesto de entrada y tope de salida |
| `AI_JSON_SCHEMA_ENABLED` | `true` | `json_schema` (o `json_object` si el proveedor no lo soporta) |
| `AI_QUOTA_TIMEZONE` | `America/Argentina/Buenos_Aires` | Medianoche de reinicio de cuota y presupuesto |
| `AI_COST_PER_1K_*_TOKENS_USD` | `0` | Tarifas para el costo estimado |
| `SIGHTENGINE_ENABLED` | `false` | Escaneo de imágenes |
| `SIGHTENGINE_THRESHOLDS` | 0.35 / 0.7 por categoría | JSON con `review` < `block` por categoría |
| `MARKETPLACE_REPORT_THRESHOLD` / `FORUM_REPORT_THRESHOLD` | `3` / `3` | Reportes abiertos que ocultan contenido |
| `FORUM_*_USER_LIMIT`, `FORUM_WRITE_IP_LIMIT` | 5 / 30 / 20 / 150 | Escrituras del foro por hora |
| `MODERATION_SHADOW_RULES` | vacío | Reglas que se evalúan sin aplicarse |
| `METRICS_TOKEN` | vacío | Habilita `GET /metrics` |
| `ALERT_*` | ver sección 6 | Umbrales de alertas |

## 5. Shadow mode

Una regla en shadow se evalúa y registra, pero **no cambia la decisión**. Sirve para medir falsos positivos antes de aplicarla.

1. Agregar la regla con `mode: 'shadow'` en `es-AR.ts`, o poner una regla existente en shadow sin deploy de código con `MODERATION_SHADOW_RULES=AR-INS-G3,AR-NEW-1` y reiniciar.
2. Las coincidencias quedan en `evidence.shadowRuleIds` de cada decisión automática y en el counter `moderation_shadow_rule_matches_total`.
3. Medir durante al menos una semana con `GET /api/v1/moderation/metrics/overview` (`moderation.shadowRules`) y revisar una muestra del contenido afectado.
4. Si la tasa de falsos positivos es aceptable, quitar el modo shadow y subir la versión de la política.

Para reglas ya activas, `moderation.forumOverrides` muestra cuántas retenciones de cada regla revirtió una persona (`overrideRate`). Una tasa alta es señal para refinarla o pasarla a shadow.

## 6. Métricas y alertas

### Resumen JSON

`GET /api/v1/moderation/metrics/overview?days=7&barrioSlug=<slug>`: EDITOR ve su barrio y ADMIN ve todo. Incluye:

- decisiones automáticas `ALLOW/REVIEW/BLOCK` y humanas por dominio;
- versiones de política usadas, reglas en shadow y overrides;
- colas (pendientes, reportes abiertos, apelaciones, imágenes en cuarentena, antigüedad del pendiente más viejo);
- IA: generaciones, tasa de caché, tokens, costo estimado, latencia media, desglose por prompt y `finish_reason`, y el presupuesto (solo ADMIN);
- `alerts` activas.

### Prometheus

`GET /metrics` (fuera de `/api/v1`), con `Authorization: Bearer $METRICS_TOKEN`. Sin token configurado responde 404. Los counters e histogramas son por instancia; los gauges de colas y presupuesto se leen de la base y de Redis en cada scrape.

| Métrica | Tipo | Etiquetas |
|---|---|---|
| `moderation_automated_decisions_total` | counter | `domain`, `decision`, `policyVersion` |
| `moderation_shadow_rule_matches_total` | counter | `domain`, `ruleId`, `decision` |
| `moderation_manual_decisions_total` | counter | `domain`, `action` |
| `moderation_reports_total` | counter | `domain`, `category` |
| `ai_prompt_injection_rejected_total` / `ai_input_too_large_total` | counter | `ruleId` / — |
| `ai_provider_requests_total` | counter | `operation`, `outcome` (`ok`, `timeout`, `rate_limited`, `unreachable`, `invalid_output`, `truncated`, `error`) |
| `ai_provider_duration_seconds` | histogram | `operation` |
| `ai_tokens_total` / `ai_estimated_cost_usd_total` | counter | `type` / — |
| `ai_cache_hits_total` / `ai_generations_total` | counter | `operation` |
| `ai_limit_rejections_total` | counter | `code` |
| `sightengine_requests_total` / `sightengine_duration_seconds` | counter / histogram | `outcome` |
| `moderation_queue_pending`, `moderation_open_reports`, `moderation_pending_appeals`, `moderation_oldest_pending_hours` | gauge | `domain`, `kind` |
| `ai_budget_tokens_spent`, `ai_budget_tokens_limit` | gauge | — |

Las etiquetas nunca llevan contenido ni datos personales.

### Alertas incluidas en el resumen

| Código | Condición | Variable |
|---|---|---|
| `AUTOMATED_BLOCK_SPIKE` | Bloqueos automáticos en la última hora ≥ umbral | `ALERT_AUTOMATED_BLOCKS_PER_HOUR` (20) |
| `AI_PROVIDER_RATE_LIMITED` | 429 del proveedor en 15 minutos ≥ umbral (por instancia) | `ALERT_AI_PROVIDER_429_PER_15_MIN` (3) |
| `QUEUE_BACKLOG` | Pendientes totales ≥ umbral (crítica al doble) | `ALERT_QUEUE_BACKLOG` (50) |
| `QUEUE_STALE` | Pendiente más viejo ≥ horas | `ALERT_QUEUE_OLDEST_HOURS` (24) |
| `AI_BUDGET_NEAR_LIMIT` | Presupuesto consumido ≥ ratio (crítica al 100 %) | `ALERT_AI_BUDGET_RATIO` (0.8) |

Las alertas activas también se loguean en `warn` al consultar el resumen. Reglas equivalentes para Prometheus/Alertmanager:

```yaml
groups:
  - name: somos-barrio-moderacion
    rules:
      - alert: ModeracionPicoDeBloqueos
        expr: sum(increase(moderation_automated_decisions_total{decision="BLOCK"}[1h])) >= 20
      - alert: ProveedorIARateLimited
        expr: sum(increase(ai_provider_requests_total{outcome="rate_limited"}[15m])) >= 3
      - alert: ColaDeModeracionAcumulada
        expr: sum(moderation_queue_pending) + sum(moderation_pending_appeals) >= 50
      - alert: ColaDeModeracionEstancada
        expr: moderation_oldest_pending_hours >= 24
      - alert: PresupuestoIACercaDelLimite
        expr: ai_budget_tokens_limit > 0 and ai_budget_tokens_spent / ai_budget_tokens_limit >= 0.8
```

## 7. Runbook

### Apagar la IA

1. `AI_ENABLED=false` y reiniciar la API.
2. Efecto: toda generación responde 503 `AI_DISABLED` sin tocar Redis ni el proveedor. La app muestra "La asistencia con IA está pausada". Publicar noticias sin IA sigue funcionando.
3. Verificar: `GET /api/v1/barrios/<slug>/news/ai/quota` devuelve `enabled: false`, y `ai_limit_rejections_total{code="AI_DISABLED"}` crece.

Alternativas menos drásticas: bajar `AI_GLOBAL_DAILY_TOKEN_BUDGET` para cortar al llegar a un presupuesto, `AI_MAX_CONCURRENCY` para limitar simultaneidad o `AI_DAILY_USER_LIMIT` para limitar por usuario.

### El proveedor de IA devuelve 429 o está caído

- Alerta `AI_PROVIDER_RATE_LIMITED` o `ai_provider_requests_total{outcome="rate_limited|unreachable"}` en aumento.
- Si el proveedor no conecta, la cuota del usuario se devuelve sola. Si responde con error, la cuota se descuenta.
- Bajar `AI_MAX_CONCURRENCY` o apagar la IA hasta que se normalice.

### Redis caído

La IA falla cerrado con 503 `AI_LIMITS_UNAVAILABLE`: nunca llama al proveedor sin contabilizar. Los locks y leases vencen solos por TTL al volver Redis. Los rate limiters HTTP fallan abiertos (`passOnStoreError`).

### Cambiar umbrales

1. Editar la variable (tabla de la sección 4) y reiniciar.
2. `SIGHTENGINE_THRESHOLDS` es JSON completo; cada categoría exige `0 ≤ review < block ≤ 1`. Si es inválido, la API no arranca.
3. Los umbrales afectan solo decisiones futuras; las existentes conservan su historial.

### Una regla genera falsos positivos

1. Confirmar en `forumOverrides` (`overrideRate` alto) o revisando la cola.
2. Mitigar sin deploy con `MODERATION_SHADOW_RULES=<ruleId>` y reinicio: la regla deja de aplicarse, pero se sigue midiendo.
3. Corregir la regla o la allowlist, subir la versión de la política y quitarla de shadow.

### Atender o vaciar colas

No hay aprobación masiva a propósito: cada decisión es auditable y exige `expectedVersion`.

1. Priorizar: `GET /api/v1/moderation/forum?queue=REPORTED` y `?queue=APPEALED`, `GET /api/v1/moderation/marketplace?queue=REPORTED`, luego `PENDING_REVIEW` y `GET /api/v1/moderation/marketplace/assets`.
2. Decidir con `POST .../decision` (APPROVE, BLOCK/REJECT, REMOVE, RESTORE) usando la `moderationVersion` que muestra la cola y una `idempotencyKey` nueva. Un 409 `MODERATION_VERSION_CONFLICT` indica que otra persona ya decidió: refrescar la cola.
3. Ante un pico de spam: pasar a shadow la regla que genera ruido si son falsos positivos, o remover el contenido si es abuso real. Bajar `FORUM_REPORT_THRESHOLD` oculta más rápido lo reportado.
4. Si la cola crece por falta de personas, sumar editores del barrio (rol `EDITOR`), que solo ven y deciden sobre su barrio.

### Operaciones sobre Redis (con cuidado)

```bash
# Invalidar toda la caché de IA (p. ej. tras detectar una respuesta inadecuada cacheada)
redis-cli --scan --pattern 'ai:cache:*' | xargs -r redis-cli del

# Devolver la cuota del día a un usuario
redis-cli del "ai:quota:<userId>:<YYYY-MM-DD>"

# Ver presupuesto consumido hoy
redis-cli get "ai:budget:<YYYY-MM-DD>"
```

Preferir subir `NEWS_PROMPT_VERSION` a borrar la caché cuando el problema viene del prompt.

## 8. Escalamiento

| Severidad | Ejemplos | Respuesta |
|---|---|---|
| Crítica | Amenaza creíble o datos personales expuestos; contenido ilegal publicado; presupuesto de IA agotado por abuso | REMOVE inmediato, apagar la IA si corresponde, avisar a administración. Si hay riesgo para una persona, contactar a las autoridades según la política del barrio. |
| Alta | `AUTOMATED_BLOCK_SPIKE`, `QUEUE_BACKLOG` crítica, ataque coordinado de reportes | Revisión en el día; ajustar umbrales o shadow; sumar editores. |
| Media | `QUEUE_STALE`, `AI_PROVIDER_RATE_LIMITED`, override alto de una regla | Revisión en 48 horas. |
| Baja | Falsos positivos puntuales, apelaciones rutinarias | Flujo normal de cola. |

## 9. Retención

- **Decisiones de moderación del foro:** append-only. Un trigger en la base rechaza cualquier `UPDATE` salvo que las FK opcionales pasen a `NULL`.
- **Hilos del foro:** borrado lógico (`deletedAt`). Las publicaciones del marketplace también (`deletedAt`); sus imágenes pasan a `DELETE_PENDING` y un proceso las limpia.
- **Reportes y apelaciones:** se conservan con su resolución.
- **`NewsAiGeneration`:** guarda el texto sugerido y el hash del original.
- **Datos que no se guardan:** prompts completos y respuestas crudas del proveedor.

No hay purga automática. Política recomendada, a aplicar manualmente o en un job futuro:

| Dato | Retención sugerida |
|---|---|
| Decisiones, reportes, apelaciones | 24 meses (evidencia ante reclamos) |
| `NewsAiGeneration` no aplicadas | 90 días |
| Contenido `REMOVED` / borrado lógico | 12 meses; luego borrado físico con sus decisiones |
| Logs de aplicación | 30 días |

Borrar un usuario elimina en cascada su contenido y sus reportes; en las decisiones, el actor queda en `NULL`.

## 10. Rollback

- **Regla nueva problemática:** ponerla en shadow (`MODERATION_SHADOW_RULES`) o revertir el commit. En ambos casos subir la versión de la política para que las decisiones nuevas se distingan.
- **Prompt de IA:** revertir el cambio y subir `NEWS_PROMPT_VERSION` (nunca reutilizar una versión anterior: la caché la asociaría a resultados de otro prompt). Mientras tanto, `AI_ENABLED=false`.
- **Umbrales:** volver al valor anterior y reiniciar.
- **Migraciones:** Prisma no tiene migraciones "down". Corregir con una migración nueva hacia adelante; no editar ni borrar migraciones ya aplicadas.
- **Decisión humana errónea:** registrar una decisión nueva que la revierta (RESTORE o APPROVE). El historial conserva ambas.

## 11. Pruebas y CI

- `src/modules/content-moderation/abuse-corpus.test.ts`: evasiones (NFKC, zero-width, bidi, homoglifos, leetspeak, separadores, fuzzy), falsos positivos en español y shadow mode.
- `src/modules/news/*.test.ts`: prompt injection, salidas inválidas o truncadas, timeouts, generaciones obsoletas, cuota, caché, concurrencia y degradación de Redis.
- `src/config/logger.test.ts`: redacción de secretos.
- `src/lib/openapi.test.ts`: cada ruta real está documentada, cada ruta documentada existe, y toda ruta con rate limit documenta su 429.
- `src/test/no-external-network.ts`: en unit e integración, cualquier HTTP fuera de localhost falla el suite. LM Studio, Sightengine, Cloudinary y Expo se mockean; CI no tiene credenciales externas.
