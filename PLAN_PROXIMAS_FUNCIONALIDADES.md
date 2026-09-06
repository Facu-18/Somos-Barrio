# Plan de proximas funcionalidades

## Objetivo

Completar los flujos pendientes del MVP sobre la base ya estabilizada, priorizando primero los problemas que afectan el uso diario y luego el circuito editorial de noticias con verificacion comunitaria y resumen asistido por IA.

## Decisiones acordadas

| Area | Decision |
| --- | --- |
| Marketplace | Cada usuario puede consultar y editar sus propias publicaciones |
| Foro | El autor o un moderador puede cerrar un hilo de forma definitiva |
| Inputs | Corregir primero el borrado de texto mientras el usuario escribe |
| Noticias | Todos los vecinos pueden crear borradores, pero requieren aprobacion editorial para publicarse |
| Verificacion | La comunidad vota `CONFIRM`, `DISPUTE` o `UNSURE`, con fundamento obligatorio y fuente opcional |
| IA local | Usar LM Studio mediante un endpoint OpenAI-compatible, accesible temporalmente por ngrok |
| IA futura | Mantener el proveedor intercambiable; evaluar Gemini 2.5 Flash-Lite como opcion economica administrada |

## 1. Corregir la escritura en formularios

- Reproducir el borrado de texto en inputs simples y multilinea.
- Revisar `ClayInput`, valores controlados, efectos y reinicializaciones de formularios.
- Evitar que refetches, renders o cambios de foco reemplacen texto que todavia no fue enviado.
- Aplicar la correccion a login, registro, perfil, marketplace, foro y formularios futuros de noticias.
- Verificar manualmente escritura continua, borrado, pegado, autocorreccion y teclado Android.

**Finalizacion:** el texto permanece estable mientras se escribe en todos los formularios de la app.

## 2. Completar la gestion personal del marketplace

### Backend

- Agregar una consulta autenticada para listar publicaciones del usuario actual dentro de su barrio.
- Agregar edicion de titulo, descripcion, precio, categoria, estado, imagen y WhatsApp.
- Autorizar cambios solo al propietario de la publicacion o a un administrador.
- Conservar la normalizacion del telefono y las reglas de pertenencia al barrio.
- Actualizar OpenAPI cuando cambien rutas, cuerpos o respuestas.

### App

- Incorporar la seccion "Mis publicaciones" desde perfil o marketplace.
- Reutilizar el formulario de creacion en modo edicion.
- Mostrar claramente publicaciones activas, vendidas o archivadas.
- Actualizar e invalidar las consultas correspondientes al guardar cambios.

**Finalizacion:** un usuario encuentra sus publicaciones, abre una de ellas, la edita y ve el resultado actualizado.

## 3. Cierre definitivo de hilos

### Backend

- Representar explicitamente el cierre del hilo y registrar quien lo cerro y cuando.
- Permitir el cierre al autor, moderadores y administradores.
- No implementar reapertura en esta etapa.
- Rechazar nuevas respuestas una vez cerrado, incluso ante solicitudes concurrentes.
- Mantener visibles el hilo y todas sus respuestas como contenido de consulta.

### App

- Mostrar la accion "Cerrar hilo" solo a usuarios autorizados.
- Solicitar confirmacion indicando que la accion es definitiva.
- Mostrar un estado visual de hilo cerrado y ocultar o deshabilitar el compositor.
- Resolver correctamente un cierre ocurrido mientras otro usuario tenia el hilo abierto.

**Finalizacion:** un hilo cerrado sigue siendo legible pero no admite reapertura ni respuestas nuevas.

## 4. Flujo editorial de noticias

### Estados y permisos

- Permitir que cualquier vecino cree y edite sus propios borradores.
- Incorporar un estado pendiente de revision entre borrador y publicado.
- Reservar aprobacion, rechazo y publicacion para editores o administradores.
- Permitir que un rechazo incluya una observacion editorial y vuelva al autor para correccion.
- Registrar autor, editor responsable y fechas de cada transicion importante.
- Disparar notificaciones barriales solo en la primera transicion efectiva a publicado.

### App

- Crear formulario para redactar, guardar y enviar una noticia a revision.
- Mostrar al autor el estado editorial y las observaciones recibidas.
- Crear una bandeja de revision para usuarios con permisos editoriales.
- Impedir desde la interfaz acciones incompatibles con el estado actual.

**Finalizacion:** cualquier vecino puede proponer una noticia, pero solo una aprobacion editorial la hace publica.

## 5. Verificacion comunitaria de noticias

### Modelo y API

- Crear un voto unico por usuario y noticia con valores `CONFIRM`, `DISPUTE` o `UNSURE`.
- Exigir un fundamento textual y aceptar una URL de fuente opcional.
- Permitir actualizar el voto propio sin crear duplicados.
- Exponer totales por opcion, cantidad de participantes y participacion del usuario actual.
- Validar URLs, longitudes y acceso desde el mismo barrio.
- Conservar los votos como senales comunitarias; no convertir automaticamente una mayoria en verdad editorial.

### Experiencia

- Mostrar el resumen de votos sin ocultar el contenido ni la autoria de la noticia.
- Permitir consultar fundamentos y fuentes con paginacion.
- Diferenciar claramente confirmacion comunitaria, disputa e incertidumbre.
- Agregar herramientas de moderacion para fundamentos abusivos o fuentes maliciosas.

**Finalizacion:** una noticia publicada recibe votos fundamentados y muestra un resultado agregado comprensible sin reemplazar el criterio editorial.

## 6. Resumen de noticias con IA

### Arquitectura

- Definir una interfaz `NewsSummaryProvider` independiente del proveedor concreto.
- Implementar primero un proveedor OpenAI-compatible para LM Studio.
- Configurar proveedor, URL base, API key, modelo, timeout y limites desde variables de entorno.
- Conectar el backend a LM Studio mediante ngrok solo como entorno controlado de desarrollo; la app nunca debe consumir ese tunel directamente.
- Proteger el endpoint expuesto, no registrar secretos y evitar enviar datos personales innecesarios.
- Mantener preparado un adaptador administrado para Gemini 2.5 Flash-Lite si se necesita disponibilidad permanente o menor operacion local.

### Flujo editorial

- Generar el resumen como asistencia al editor, no como publicacion automatica.
- Guardar resumen, proveedor, modelo, fecha y version o hash del contenido fuente.
- Invalidar el resumen cuando cambia el contenido de la noticia.
- Permitir regenerar, editar o descartar el resultado antes de aprobar la publicacion.
- Aplicar limites de entrada y salida, timeout, reintentos acotados y errores controlados.

**Finalizacion:** el editor puede generar un resumen con LM Studio, revisarlo y publicarlo sin acoplar el dominio a ese proveedor.

## Orden de implementacion

1. Corregir la escritura en formularios.
2. Agregar "Mis publicaciones" y edicion de marketplace.
3. Implementar cierre definitivo de hilos.
4. Implementar borradores y aprobacion editorial de noticias.
5. Incorporar verificacion comunitaria.
6. Integrar resumen asistido por IA.
7. Realizar pulido transversal de permisos, estados vacios, errores y accesibilidad.

## Criterios transversales

- Crear migraciones Prisma compatibles con datos existentes.
- Mantener OpenAPI sincronizado con rutas, validaciones y respuestas.
- Aplicar autorizacion en backend; la visibilidad de botones en la app no reemplaza controles de acceso.
- Mantener las operaciones limitadas al barrio del usuario cuando corresponda.
- Usar variables de entorno para endpoints, modelos y credenciales; no guardar secretos en Git.
- Verificar typecheck y build de cada paquete afectado, junto con una prueba manual del flujo principal en Android.
