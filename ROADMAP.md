# Roadmap MVP Somos Barrio

## Alcance acordado

| Funcionalidad | Decisión |
| --- | --- |
| Perfil | Apodo público separado del nombre completo |
| Marketplace | WhatsApp por publicación |
| Eventos | Quinta pestaña principal |
| IA local | Ollama mediante un proveedor intercambiable |
| Push | Expo Push Service con Firebase FCM V1 |
| Pruebas push | Celular Android con EAS development build |
| Noticias | Notificar a los usuarios del barrio |
| Barrio inicial | Parque Liceo |

## 0. Estabilización móvil

- Restaurar la sesión al abrir la aplicación mediante el refresh token.
- Agregar un guard de autenticación en `app/(app)/_layout.tsx` y dejar de redirigir siempre al login desde `app/index.tsx`.
- Serializar los refresh concurrentes para no consumir dos veces el mismo token rotativo.
- Corregir logout para enviar y revocar el refresh token en el backend.
- Corregir los errores actuales de rutas tipadas y la dependencia de `expo-secure-store` incompatible con Expo SDK 54.
- Centralizar los tipos de respuestas API y paginación.
- Exigir `npm run lint` y `npx tsc --noEmit` como verificación móvil.
- Incorporar CI móvil; el workflow raíz actual solo cubre `Backend/**`.

**Finalización:** cerrar y abrir la app mantiene la sesión, logout la revoca y TypeScript no reporta errores.

## 1. Parque Liceo y contexto de barrio

- Crear Parque Liceo con slug `parque-liceo` y sus subforos iniciales.
- Garantizar su existencia tanto en desarrollo como en producción; actualizar solo el seed no alcanza si producción no ejecuta seeds.
- Hacer que `/auth/mobile/register` use `parque-liceo` cuando no recibe `barrioSlug`.
- Enviar también el slug desde la app y ocultar o bloquear el selector durante este MVP.
- Eliminar todos los fallbacks actuales a `palermo`.
- Mostrar un error controlado si un usuario no tiene barrio asignado.
- Validar que marketplace, foro, eventos y reseñas solo se escriban en el barrio del usuario.

**Finalización:** todo usuario móvil nuevo pertenece a Parque Liceo y todas las consultas usan ese slug.

## 2. Perfil personalizable

- Agregar `nickname` y `bio` opcional a `User`; conservar `name` como nombre completo.
- Agregar `avatarPublicId` además de `avatarUrl` para reemplazar o eliminar imágenes de Cloudinary sin dejar archivos huérfanos.
- Crear `PATCH /auth/me` para actualizar apodo, biografía y avatar.
- Rechazar cuerpos vacíos, apodos inválidos y URLs de avatar arbitrarias.
- Actualizar las selecciones públicas de autores, OpenAPI y pruebas de integración.
- Crear la pantalla `edit-profile` y reutilizar `expo-image-picker` y el upload existente.
- Invalidar `['auth', 'me']` al guardar y mostrar apodo/avatar en perfil, foro, noticias, marketplace y reseñas.

**Finalización:** el usuario edita su perfil y los nuevos datos aparecen en todas sus publicaciones.

## 3. WhatsApp en marketplace

- Agregar `whatsapp` nullable a `MarketplacePost` mediante una migración compatible con publicaciones existentes.
- Exigir el número para publicaciones nuevas de la app y permitir editarlo o quitarlo.
- Normalizar y validar el número en formato internacional, preferentemente E.164.
- Exponerlo en el detalle y no en listados para reducir scraping.
- Informar que el número será visible para otros usuarios.
- Agregar el campo a `create-market.tsx` con teclado telefónico y vista previa normalizada.
- Abrir `https://wa.me/<numero>?text=<mensaje>` desde el detalle mediante `Linking`.
- Actualizar OpenAPI y pruebas de marketplace.

**Finalización:** una publicación puede abrir una conversación con el vendedor en WhatsApp.

## 4. Detalle de comercio

- Crear `business/[slug].tsx` y hacer navegables las tarjetas existentes.
- Consumir el endpoint de detalle ya implementado.
- Mostrar portada, galería, descripción, dirección, verificación, propietario y datos de contacto.
- Abrir teléfono, WhatsApp, web e Instagram mediante enlaces seguros.
- Mostrar reseñas, promedio y cantidad reales; eliminar la calificación fija `4,5`.
- Mostrar ubicación cuando existan coordenadas.
- Agregar estados de carga, error, reintento e imágenes faltantes.

**Finalización:** cada tarjeta abre una página completa con información, reseñas y contacto real.

## 5. Eventos

- Crear `events.tsx` como quinta pestaña principal.
- Crear `event/[id].tsx` para detalle y RSVP.
- Mostrar próximos eventos ordenados por fecha y ofrecer filtros de próximos/pasados.
- Mostrar fecha, hora, ubicación, descripción y organizador.
- Permitir marcar `GOING`, `INTERESTED` o `NOT_GOING`.
- Corregir el conteo backend para no considerar `NOT_GOING` como asistente.
- Evitar exponer innecesariamente la identidad completa de los asistentes.
- Mantener creación y administración móvil fuera de esta primera entrega.

**Finalización:** Eventos funciona como sección independiente y permite confirmar asistencia.

## 6. Respuestas anidadas del foro

- Devolver todas las respuestas como una colección plana con `parentReplyId` y orden determinista.
- Agregar un índice a `parentReplyId` y validar que el padre pertenezca al mismo hilo.
- Probar respuestas raíz, respuestas a hijos y múltiples niveles.
- Construir el árbol en la app.
- Agregar “Responder”, contexto del destinatario y opción para cancelar.
- Enviar `parentReplyId` al crear la respuesta.
- Limitar la indentación visual después de tres niveles sin limitar la profundidad lógica.
- Resaltar la respuesta objetivo cuando se abre el hilo desde una notificación.

**Finalización:** se puede responder cualquier respuesta y conservar visible toda la conversación.

## 7. Notificaciones push Android

### Configuración

- Definir el identificador Android definitivo y vincular el proyecto con EAS.
- Instalar las versiones SDK 54 de `expo-notifications` y `expo-device`.
- Configurar el plugin, icono monocromático, color y canal Android.
- Configurar `google-services.json` y `android.googleServicesFile`.
- Subir la clave privada FCM V1 a EAS Credentials; nunca guardarla en Git.
- Crear un development build, ya que el push remoto Android no funciona en Expo Go desde SDK 53.

### Registro y entrega

- Crear un modelo `PushDevice` que soporte varios dispositivos por usuario.
- Crear endpoints autenticados para registrar, actualizar y desregistrar tokens.
- Registrar el token después de restaurar la sesión y escuchar su rotación.
- Encapsular Expo Push Service en un servicio backend.
- Incorporar una outbox persistente con reintentos para que un fallo push no revierta la operación principal.
- Procesar tickets y receipts de Expo y deshabilitar tokens `DeviceNotRegistered`.

### Casos iniciales

- Al publicar una noticia, notificar dispositivos activos de usuarios del mismo barrio.
- Disparar solo en la transición a `PUBLISHED`, no en ediciones posteriores.
- Al responder un hilo, notificar al autor del hilo.
- Al responder otra respuesta, notificar al autor de la respuesta padre.
- No enviar notificaciones al autor de la acción y deduplicar destinatarios.
- Incluir deep links al detalle de noticia o al hilo/respuesta correspondiente.
- Manejar notificaciones con la app abierta, en segundo plano y cerrada.

**Finalización:** publicar una noticia o responder en el foro genera push en Android y abre el contenido correcto.

## 8. Resúmenes de noticias con IA

- Mantener `excerpt` para el resumen editorial y agregar `aiSummary`.
- Guardar modelo, fecha y hash o versión del contenido resumido.
- Mostrar `aiSummary ?? excerpt` en la aplicación.
- Crear una interfaz `NewsSummaryProvider` e implementar primero `OllamaSummaryProvider`.
- Configurar proveedor, URL, modelo, timeout y límites mediante variables de entorno.
- Consumir `POST /api/generate` de Ollama con `stream: false`.
- No fijar el modelo en código y preparar un adaptador para un proveedor pago futuro.
- Crear un endpoint protegido para generar o regenerar el resumen.
- Invalidar el resumen cuando cambia el contenido y generarlo antes de publicar.
- Aplicar límites de entrada/salida, timeout y errores controlados.
- Mockear el proveedor en tests; CI no debe depender de Ollama.
- Crear el detalle de noticia para mostrar resumen y contenido completo y servir como destino de deep links.

**Finalización:** una noticia genera su resumen con Ollama sin acoplar el dominio a un proveedor específico.

## 9. Mejoras visuales y de experiencia

- Aplicar mejoras durante cada fase, no acumularlas al final.
- Reemplazar offsets fijos por safe-area insets.
- Adaptar la barra de cinco pestañas a pantallas pequeñas.
- Eliminar anchos fijos y usar `FlatList` para listados extensos.
- Crear componentes compartidos para carga, error, vacío y reintento.
- Agregar placeholders y manejo de errores para imágenes remotas.
- Convertir las búsquedas decorativas actuales en controles funcionales.
- Incorporar etiquetas, roles de accesibilidad, estados presionados y tamaños táctiles adecuados.
- Centralizar colores semánticos en `ClayTheme` y preservar el lenguaje visual clay.
- Actualizar nombre, slug, scheme, iconos, splash y README genéricos de Expo.

## Orden de entregas

1. Estabilidad de sesión y calidad móvil.
2. Parque Liceo y reglas de pertenencia.
3. Perfil editable.
4. WhatsApp en marketplace.
5. Detalle de comercio.
6. Eventos.
7. Foro anidado.
8. Push Android.
9. Resúmenes con Ollama.
10. Pulido visual transversal.

## Verificación por entrega

- Backend: Prisma generate, typecheck, tests focalizados, integración y build.
- App: lint, TypeScript y prueba manual Android.
- Cambios de contrato: actualizar siempre `Backend/src/lib/openapi.ts`.
- Nuevos modelos: agregarlos a `Backend/src/test/setup.ts` para limpiar la base de integración.
- Push: probar permiso denegado, token inválido, app abierta, segundo plano y cerrada.
- IA: probar timeout, Ollama desconectado, contenido largo y regeneración.
- Migraciones: probar sobre datos existentes, no solamente sobre una base vacía.
