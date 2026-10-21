# 2post: brief de producto aportado por el founder

Fecha: 2026-10-20. Fuente: borrador PRD V0/MVP entregado en esta conversación. Esta es una síntesis fiel de sus requisitos, no una especificación aprobada ni evidencia de implementación.

## Encargo

Refinar el PRD y derivar TRD, Backend Schema e Implementation Plan. Solo documentación. El repositorio actual contiene únicamente `README.md` con el nombre del producto. No recuperar como autoridad el antiguo repositorio Django de `thedavos/2post`.

Usar un subagente Claude Opus 5.5 con esfuerzo high para refinar el PRD. Los documentos se escriben en español, con identificadores y contratos técnicos en inglés. El owner autoriza resolver elecciones rutinarias como propuestas explícitas y registrar decisiones comerciales o bloqueos externos sin inventar confirmaciones.

## Visión del founder

2post es infraestructura de publicación social para aplicaciones y agentes. Primero API REST y MCP, consumibles desde agentes como Muse o Grokbot y desde SaaS, CMS, CRM, scripts, n8n, Make y Zapier. La web futura consume las mismas capacidades. Habrá una plataforma de pago posteriormente. También se planea ayudar a refinar contenido con IA elegida por el usuario, incluyendo ChatGPT o Claude, en una fase futura. No construir IA de contenido ni billing en el MVP. Distinguir productos de chat de APIs comerciales de modelos, sin asumir acceso BYO a suscripciones.

Propuesta: una interfaz unificada para conectar cuentas, crear contenido, publicar, programar, seguir resultados y cancelar trabajo pendiente. Abstracción multired sin esconder limitaciones reales. Agentes necesitan operaciones semánticas, respuestas estructuradas, idempotencia y errores accionables.

## Personas y necesidades

- Developer y product builder: API estable, keys, documentación, webhooks y fallos claros, sin integrar cada red por separado.
- AI agent: publicar por cuenta del usuario con herramientas seguras, cuentas explícitas y estado consultable.
- Automation builder: crear flujos con API sin depender de dashboard.
- JTBD: publicación multired; programación futura; ejecución por agentes; diagnóstico y retry; elegir entre varias cuentas.

## Principios y alcance inicial

API first, AI-native, dominio independiente de proveedor, adapters por red y proveedor, monolito modular, simplicidad operativa. No microservicios.

Stack pedido: TypeScript, NestJS con Fastify, PostgreSQL, API stateless y workers de jobs. Social SDK es integración inicial deseada detrás de `SocialGateway`, nunca importado por el dominio. La identidad exacta de ese SDK no fue proporcionada; verificar o marcar pendiente. No elegir un paquete por coincidencia del nombre.

Redes objetivo: X, LinkedIn y Bluesky. Threads e Instagram después. Solo exponer integraciones verificadas con acceso, estabilidad y formatos probados; presencia en un SDK no prueba disponibilidad. Texto e imágenes son objetivo inicial; videos y múltiples imágenes después, aunque el dominio pueda evolucionar para representarlos.

Core MVP: conectar cuentas, crear posts reutilizables, publicar inmediato o programado en varias cuentas y consultar resultados por destino. API y MCP oficiales; webhooks, keys, rate limits, logs sin secretos. Panel mínimo opcional para conectar cuentas, gestionar keys e inspeccionar estado; ningún dashboard editorial avanzado.

## Modelo del borrador

- User: id, email, createdAt.
- Workspace: id, name, ownerId, createdAt. Un usuario inicialmente puede tener uno, pero preparar aislamiento para equipos y SaaS.
- SocialAccount: workspaceId, network, externalAccountId, username, displayName, provider, providerAccountId, status, timestamps. No devolver tokens.
- Post: workspaceId, content, media y estado agregado.
- Publication: postId, socialAccountId, network, contenido y media efectivos, scheduledAt, status, externalId, externalUrl, publishedAt y último error.
- Post es contenido; Publication es un destino social. Refinar la ambigüedad entre publicación lógica e intento HTTP: los retries necesitan historia separada.
- Overrides de contenido por destino, con contenido raíz como fallback.
- PostStatus original: draft, scheduled, publishing, published, partially_published, failed, cancelled, derivado de Publications.
- PublicationStatus original: pending, scheduled, publishing, published, failed, cancelled. Refinar estados de retry y resultado desconocido si hacen falta.

## API propuesta del borrador

Base `/v1`. Accounts: GET /accounts y /accounts/:id. Posts: POST y GET /posts, GET /posts/:id, DELETE /posts/:id solo para drafts sin ejecución. Publicación: POST /posts/:id/publish con accounts[]. Programación: POST /posts/:id/schedule con accounts[] y scheduledAt RFC3339 con offset. Cancelación: POST /posts/:id/cancel solo trabajo aún no ejecutado. Publications: GET /publications y /publications/:id.

GET /posts filtra status, network, from, to, limit, cursor. GET /publications filtra status, network, postId, accountId. Operaciones de envío son asíncronas, sin esperar a providers. Operación de conveniencia deseada: POST /publish con content y networks[] que crea Post, resuelve cuentas y crea Publications. Definir qué pasa si hay varias cuentas por red, sin selección silenciosa.

Faltan en el borrador: bootstrap de usuario y workspace, gestión de keys, endpoints de conexión/reconexión de cuentas, media, endpoints de suscripción webhook, edición/reprogramación, retry seguro y contratos completos. Resolver de forma mínima, sin añadir un producto distinto.

## MCP del borrador

Tools iniciales: list_accounts, create_post, get_post, list_posts, publish_post, schedule_post, cancel_post, get_publication. Publicar y programar aceptan content, networks y fecha cuando corresponda. Refinar cómo operar posts ya creados, accountIds, overrides, selección ambigua, claves de idempotencia, scopes y autenticación.

No afirmar compatibilidad probada con Muse, Grokbot, ChatGPT o Claude. Definir transportes y matriz de verificación por cliente real. Frases como "mañana a las 9" se interpretan con zona confirmada; el servicio recibe tiempo inequívoco.

## Ejecución y seguridad del borrador

Jobs: scheduler encuentra Publications vencidas, encola, worker invoca SocialGateway, persiste resultado. Propuesta original de clave: publication:{id}:publish y check/lock/publish/persist/unlock. Exige evitar duplicados en retry. Corregir promesa de exactly-once si el proveedor no permite idempotencia o reconciliación: un timeout tras un side effect puede ser desconocido.

Retry inicial sugerido: 5s, 30s, 2m y 10m para 429, 5xx, timeout o indisponibilidad. Refinar clasificación antes/después del envío, Retry-After, jitter, límites y agotamiento. Fallos definitivos: permisos, desconexión o contenido inválido.

Rate limits por consumidor, workspace, cuenta y proveedor. OAuth de redes sin exponer credenciales. API keys `2p_test_...` y `2p_live_...`, mostrar una vez y almacenar solo hash. El borrador pospone scopes; evaluar permiso mínimo desde MVP para agentes. Diferenciar aislamiento test/live de mero prefijo.

Webhook events originales: post.created, publication.scheduled, publication.publishing, publication.published, publication.failed, publication.cancelled, account.connected, account.disconnected. Envelope id/type/createdAt/data. Añadir firma, retries y dedupe y protección de destinos.

Media original: id, type image|video, url, mimeType y size. Refinar carga segura, ownership, validación, vida útil y límites, sin fetch arbitrario vulnerable a SSRF.

Logs con requestId, jobId, postId, publicationId, workspaceId, socialAccountId, network y provider. Nunca tokens ni keys ni secretos.

## Métricas originales y éxito

Métrica principal: publicaciones exitosas. Objetivos iniciales, aún no contratos comerciales: >99% válidas ejecutadas correctamente excluyendo fallos de proveedor/permisos, latencia publicación p95 <30s, precisión de comienzo de programación ±30s, operaciones internas p95 <300ms. Definir denominadores, ventanas, instante inicial/final, carga de prueba y errores visibles en lugar de ocultar los del proveedor. No publicar antes de scheduledAt.

Aceptación E2E: crear identidad/workspace/key, conectar X y LinkedIn, listar cuentas, crear Post, publicar ambos, programar uno nuevo, consultar resultado y recibir webhook. Repetir desde MCP; incluir Bluesky en criterio de disponibilidad completo de las tres redes objetivo o delimitar piloto verificable.

## Futuro y exclusiones

Futuro: plataforma web de pago, SDK TypeScript y después Python, CLI, Threads, Instagram, múltiples imágenes, video, equipos y roles, aprobaciones, analytics, plantillas y recurrencia. Asistencia IA para refinar contenido con proveedor elegido, presupuestos y consentimiento, sin cambiar el contenido al publicar de forma silenciosa.

Fuera MVP: inbox, responder comentarios, analytics avanzados, listening, campañas, calendario colaborativo, generación IA, competencia, CRM, ads y CSV masivo. No precrear tablas vacías para todo el roadmap. Workspace y ownership constituyen base para SaaS sin billing anticipado.
