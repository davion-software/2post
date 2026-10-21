# 2post: Product Requirements Document (PRD)

| Campo | Valor |
|---|---|
| Versión | 0.4 (lanzamiento de pago, presupuesto de X y runtime) |
| Fecha | 2026-10-21 |
| Estado | Propuesta para revisión del founder. Nada de este documento está implementado. |
| Fuente | `docs/references/PRODUCT-BRIEF.md` (síntesis fiel del borrador original de 47 secciones) |
| Documentos derivados | [TRD](TRD.md), [Backend Schema](BACKEND-SCHEMA.md) e [Implementation Plan](IMPLEMENTATION-PLAN.md) |

Refinamiento inicial: Claude Opus 5.5, esfuerzo high, mediante subagente. Integración posterior: contratos conciliados con TRD y Schema; se precisaron confirmación remota asíncrona, evidencia de reconciliación y preservación del historial. Investigación oficial consultada en [Integration Research](references/INTEGRATION-RESEARCH.md). La versión 0.3 integra las respuestas del founder del 2026-10-21 a Q-01–Q-11 (§18 y §19). La versión 0.4 incorpora su aprobación del presupuesto y los planes propuestos, el lanzamiento de pago con operación manual y Node.js 24. Se conserva Fastify tras verificar el anuncio de platform-node. Ver [plan comercial](COMMERCIAL-PLAN.md).

## 0. Cómo leer este documento

- **Idioma.** Prosa en español; identificadores, rutas, campos, enums y códigos de error en inglés.
- **Fases.** Cada requisito lleva una etiqueta: **[P]** obligatorio desde el piloto parcial, **[M]** obligatorio para declarar el MVP objetivo, **[F]** futuro, fuera del MVP. Lo marcado [P] también es [M].
- **Fuerza.** "Debe" es obligatorio. "Debería" es recomendado y se puede posponer con una decisión registrada.
- **IDs.** `ÁREA-NN` para requisitos, `AC` para sus criterios de aceptación, `D-NN` para decisiones, `Q-NN` para preguntas abiertas, `G-NN` para puertas externas, `E2E-NN` para escenarios de aceptación.
- **Propuesta frente a hecho.** Los valores numéricos marcados *(propuesta)* son valores iniciales razonables que el TRD puede ajustar sin cambiar el PRD. Las capacidades de redes sociales, SDKs y clientes MCP son **hipótesis por verificar**, nunca hechos, hasta pasar su puerta (§4.3).
- **Autoridad.** No se usa como referencia el antiguo repositorio Django `thedavos/2post`.

## 1. Resumen

2post es infraestructura de publicación social para aplicaciones y agentes. Expone una API REST y un servidor MCP para conectar cuentas sociales, crear contenido, publicar de inmediato o programar en varias cuentas, seguir el resultado por destino y cancelar trabajo pendiente. Los consumidores previstos son agentes personales de IA (por ejemplo Muse o Grokbot; 2post es agnóstico al agente), SaaS, CMS, CRM, scripts y plataformas de automatización (n8n, Make, Zapier). Una web futura usará las mismas capacidades.

La abstracción es multired pero no esconde limitaciones: cada red declara lo que soporta, 2post valida contra eso y rechaza lo que no cabe en lugar de alterarlo.

2post vende acceso a su infraestructura desde el lanzamiento, con cobro externo y activación manual por workspace. El MVP incluye planes y límites operativos, sin registro público ni motor propio de suscripciones. La plataforma web y la asistencia de contenido por IA elegida por el usuario se construyen después (§16).

## 2. Problema y propuesta de valor

Integrar la publicación en cada red por separado exige OAuth propio, tokens, límites de formato, errores heterogéneos, rate limits y reintentos. Un agente de IA añade dos riesgos: publicar en la cuenta equivocada y duplicar publicaciones al reintentar una llamada.

2post resuelve:

1. Una sola integración (REST o MCP) para varias redes.
2. Operaciones semánticas con respuestas estructuradas y errores accionables.
3. Idempotencia en la API y ejecución que no duplica por reintentos automáticos.
4. Estado consultable por destino, con webhooks firmados.
5. Selección de cuentas explícita y acotable por API key.

## 3. Personas y trabajos por resolver

| Persona | Necesita | Requisitos principales |
|---|---|---|
| Developer / product builder | API estable, keys, documentación, webhooks, errores claros | API, KEY, WHK, ERR |
| Agente de IA | Herramientas seguras, cuentas explícitas, estado consultable, idempotencia | MCP, TGT, IDM, EXE |
| Automation builder | Operar todo por API sin dashboard | API, ACC (connect links), WHK |
| Founder / operador | Arrancar workspaces, diagnosticar, ver métricas | IDN, OBS, MET |

Trabajos (JTBD):

- **J1** Publicar el mismo contenido en varias redes y cuentas en una llamada.
- **J2** Programar publicaciones para un instante exacto.
- **J3** Que un agente publique en nombre del usuario sin riesgo de cuenta arbitraria.
- **J4** Diagnosticar fallos y reintentar de forma segura.
- **J5** Elegir entre varias cuentas de la misma red.

## 4. Alcance por fase y puertas externas

### 4.1 Producto objetivo (MVP)

- Identidad mínima, workspace y API keys con scopes y entornos `test`/`live` aislados.
- Conexión de cuentas por OAuth humano mediante enlace de conexión.
- Redes objetivo: X, LinkedIn y Bluesky, **cada una sujeta a su puerta de verificación**.
- Contenido: texto y una imagen por publicación. La imagen llega por carga binaria o multipart, por URL HTTPS pública o como `mediaId` ya cargado, y se publica sin metadatos EXIF ni GPS.
- Posts reutilizables, overrides por red y por destino, publicación inmediata y programada, cancelación, edición y reprogramación de lo programado, retry seguro y reconciliación de resultados desconocidos.
- REST `/v1`, MCP sobre Streamable HTTP, webhooks firmados, feed de eventos, rate limits, logs sin secretos, métricas definidas.
- Integraciones live mediante adapters directos de Social SDK detrás de `SocialGateway` (D-16).
- Producción alojada en AWS, región US East (N. Virginia, `us-east-1`) (D-23).

El lanzamiento comercial usa los planes y límites de §12.5. Un piloto de 3 a 5 design partners puede recibir acceso gratuito explícito y acotado; no crea un plan gratuito de X para el público.

### 4.2 Piloto parcial

Un piloto es una entrega verificable antes del MVP completo. Se declara cuando:

- Todo lo marcado [P] funciona en `test` con el gateway simulado.
- Al menos **una** red ha pasado su puerta y cumple NET-02 en `live` (§12.3).
- REST y MCP (Streamable HTTP) operan sobre las mismas capacidades.
- Las métricas de §15 se recogen; sus objetivos no se comprometen todavía.
- Los workspaces los crea el operador (no hay registro público).

Cualquier red sin puerta superada aparece como `unavailable` en `live` y no admite conexiones ni publicaciones.

### 4.3 Puertas externas

Las puertas son dependencias fuera del control del código. Ningún documento puede declararlas superadas sin la evidencia indicada.

| ID | Puerta | Bloquea | Evidencia para superarla |
|---|---|---|---|
| G-01 | Acceso a la API de X con pago por consumo: app de desarrollador de 2post, créditos, permisos de escritura y subida de media | X en `live` | App con créditos, publicación de texto e imagen desde una cuenta real, precio vigente por operación (con y sin URL) con enlace y fecha, presupuesto aprobado y topes de gasto configurados (COST-01 a COST-03) |
| G-02 | Acceso a la API de LinkedIn: producto que permite publicar en perfil de miembro; revisión de app si aplica | LinkedIn en `live` | App con el permiso concedido, publicación real de texto e imagen, caducidad de tokens documentada |
| G-03 | Bluesky / AT Protocol: modelo de autenticación (OAuth de AT Protocol frente a app password) y publicación de imagen | Bluesky en `live` | Decisión D-08 confirmada, publicación real de texto e imagen |
| G-04 | Capacidades efectivas de los adapters directos de Social SDK (`@opencoredev/social-sdk`) por red. La identidad del paquete ya está decidida (D-16) | Declarar `available` una red respaldada por el SDK | Pruebas de integración con la versión fijada: conexión, texto, imagen, errores y clasificación de resultados (§12.2, NET-02) |
| G-05 | Compatibilidad de agentes personales concretos (Muse, Grokbot u otros) con el MCP remoto de 2post | Afirmar compatibilidad con ese agente. **No bloquea el MVP** (D-17) | Fila de la matriz §10.3 completada con build, transporte, auth, versión y fecha |
| G-06 | Dominio HTTPS público y URLs de callback OAuth registradas en cada red | Cualquier red en `live` | Callback funcional en el dominio de producción |
| G-07 | Política de privacidad y términos publicados (las revisiones de apps suelen exigirlos) | G-01, G-02 si la red los pide | URLs públicas |

Puntos de partida oficiales. El subagente no navegó; la integración posterior consultó las páginas concretas registradas en [Integration Research](references/INTEGRATION-RESEARCH.md). No equivalen a pruebas live:

- X API: https://docs.x.com/
- LinkedIn (Microsoft Learn): https://learn.microsoft.com/en-us/linkedin/
- Bluesky: https://docs.bsky.app/ y AT Protocol OAuth: https://atproto.com/specs/oauth
- Model Context Protocol: https://modelcontextprotocol.io/specification

### 4.4 Fuera del MVP

Inbox, respuesta a comentarios, analytics avanzados, listening, campañas, calendario colaborativo, generación o asistencia de contenido por IA, análisis de competencia, CRM, ads, importación CSV masiva, video, varias imágenes por publicación, Threads, Instagram, páginas de organización de LinkedIn, backends gestionados de Social SDK, `missedSchedulePolicy` configurable, equipos y roles, aprobaciones, plantillas, recurrencia, facturación automatizada y suscripciones self-serve, registro público, borrado de publicaciones ya hechas en la red, panel editorial.

## 5. Principios de producto

| ID | Principio |
|---|---|
| PR-01 | API first: toda capacidad existe primero en REST; MCP y la web futura son adaptadores sobre los mismos casos de uso y no tienen privilegios propios. |
| PR-02 | Explícito antes que implícito: nunca se elige una cuenta, se recorta un texto o se reintenta un envío ambiguo sin que el llamante lo vea o lo pida. |
| PR-03 | Honestidad del resultado: 2post no promete exactly-once externo. Si no sabe si algo se publicó, lo dice (`unknown`). |
| PR-04 | Dominio independiente de proveedor: el dominio no importa SDKs ni clientes de redes. Todo pasa por `SocialGateway`; Social SDK solo vive dentro de los adapters. |
| PR-05 | Monolito modular: un despliegue con proceso API stateless y proceso worker, PostgreSQL como única fuente de verdad y de coordinación. Sin microservicios. |
| PR-06 | Solo se expone lo verificado: una red, formato o cliente aparece como soportado cuando ha pasado su puerta. |
| PR-07 | Sin tablas especulativas: el roadmap no crea estructuras vacías; la extensibilidad se resuelve con límites de módulo y ownership por workspace. |

## 6. Modelo de dominio conceptual

Este apartado fija conceptos e invariantes. Los nombres de tablas, columnas e índices los decide el Backend Schema.

### 6.1 Entidades

| Entidad | Propósito | Campos conceptuales mínimos |
|---|---|---|
| `User` | Persona dueña de un workspace. Sin login en el MVP. | `id`, `email`, `createdAt` |
| `Workspace` | Unidad de aislamiento, ownership y futura facturación. | `id`, `name`, `ownerUserId`, `createdAt` |
| `Environment` | `test` o `live`. No es una entidad propia sino una dimensión obligatoria de todo recurso de workspace. | — |
| `ApiKey` | Credencial de máquina ligada a workspace + entorno. | `id`, `workspaceId`, `environment`, `name`, `prefix`, `last4`, `secretHash`, `scopes[]`, `allowedAccountIds[]` o `all`, `createdAt`, `lastUsedAt`, `expiresAt?`, `revokedAt?` |
| `ConnectSession` | Enlace de conexión OAuth de un solo uso. | `id`, `workspaceId`, `environment`, `network`, `reconnectAccountId?`, `status`, `expiresAt`, `accountId?`, `error?` |
| `SocialAccount` | Cuenta social conectada. | `id`, `workspaceId`, `environment`, `network`, `externalAccountId`, `accountType` (`personal`/`organization`), `username`, `displayName`, `provider`, `providerAccountId?`, `status`, `isDefault`, `connectedAt`, `updatedAt`. Credenciales cifradas y nunca devueltas. |
| `Media` | Imagen subida y validada por 2post. | `id`, `workspaceId`, `environment`, `type` (`image`), `mimeType`, `sizeBytes`, `width`, `height`, `sha256`, `source` (`upload`/`url`), `metadataStripped`, `status`, `expiresAt?`, `createdAt` |
| `Post` | Contenido reutilizable. | `id`, `workspaceId`, `environment`, `content`, `overrides` (por red), `status` derivado, `publicationCounts`, `createdAt`, `updatedAt` |
| `Publication` | **Destino lógico**: un Post hacia una SocialAccount, con contenido congelado. | `id`, `postId`, `socialAccountId`, `network`, `content` (snapshot efectivo), `contentVersion`, `scheduledAt?`, `status`, `version`, `nextAttemptAt?`, `attemptCount`, `externalId?`, `externalUrl?`, `publishedAt?`, `late`, `lateBySeconds?`, `lastError?`, `resolution?`, `cancelReason?`, timestamps |
| `PublicationAttempt` | **Cada ejecución** contra el proveedor. Historia append-only. | `id`, `publicationId`, `number`, `claimedAt`, `dispatchStartedAt?`, `completedAt?`, `outcome`, `error?`, `providerRequestId?`, `httpStatus?`, `retryAfter?`, `workerId` |
| `WebhookEndpoint` | Destino de eventos. | `id`, `workspaceId`, `environment`, `url`, `events[]`, `status`, `secretHash`/secreto cifrado, `createdAt` |
| `Event` | Hecho de dominio publicado a webhooks y al feed. | `id`, `type`, `workspaceId`, `environment`, `createdAt`, `actor`, `data` |
| `WebhookDelivery` | Intento de entrega de un Event a un endpoint. | `id`, `eventId`, `endpointId`, `attempt`, `status`, `httpStatus?`, `nextAttemptAt?` |
| `IdempotencyRecord` | Respuesta guardada por clave de idempotencia. | `workspaceId`, `environment`, `key`, `requestHash`, `status`, `response`, `expiresAt` |

### 6.2 Contenido

```
Content {
  text: string            // exacto, sin normalizar
  media: MediaRef[]       // 0..1 en el MVP
}
MediaRef { mediaId: string, altText?: string }
```

Resolución del contenido efectivo de una Publication en el momento de crearla, de mayor a menor precedencia:

1. `content` del target en la petición de publicar o programar.
2. `overrides[network]` del Post.
3. `content` raíz del Post.

Un override **reemplaza el objeto completo** (texto y media). No hay mezcla campo a campo: un override con solo texto publica sin imagen.

### 6.3 Invariantes

- **INV-01** Todo recurso de workspace pertenece a exactamente un `(workspaceId, environment)` y solo es visible con una key de ese par.
- **INV-02** El contenido de una Publication se copia al crearla. Editar el Post después no la modifica. Solo PUB-07 puede crear otra versión del snapshot mientras sigue `scheduled`, antes del claim; las versiones anteriores se conservan.
- **INV-03** Para un mismo `(postId, socialAccountId)` existe como máximo una Publication no terminal (estados activos o `unknown`).
- **INV-04** Ningún `PublicationAttempt` tiene `dispatchStartedAt < Publication.scheduledAt`.
- **INV-05** Un intento con `dispatchStartedAt` no nulo y sin resultado concluyente nunca se vuelve a despachar automáticamente, salvo que la red tenga `idempotentCreate` verificado (EXE-09).
- **INV-06** `Post.status` es función pura de los estados de sus Publications (§9.3).
- **INV-07** Logs, eventos y errores nunca contienen tokens de redes, secretos ni URLs de conexión completas. Las únicas respuestas con secretos son creación de API key, creación o rotación de secreto webhook y creación del enlace de conexión; se entregan una vez al caller autorizado y no se guardan en un replay recuperable.
- **INV-08** Una misma identidad externa puede estar conectada en varios workspaces, pero cada conexión es independiente: autorización, credenciales y acceso nunca se comparten ni se infieren entre workspaces (ACC-09).

## 7. Requisitos funcionales

### 7.1 Identidad, bootstrap y workspace (IDN)

**IDN-01 [P]** El operador crea User, Workspace y las keys iniciales con un comando administrativo del monolito, sin endpoint público.
- AC1: Ejecutar el bootstrap con `email` y `workspaceName` crea un User, un Workspace y dos keys de administración (una `test`, una `live`) con todos los scopes.
- AC2: Los secretos de las keys se muestran una sola vez en la salida del comando; repetir el comando no puede recuperarlos.
- AC3: Si el email ya existe, el comando falla salvo que se pida explícitamente un workspace adicional para ese User.

**IDN-02 [P]** `GET /v1/me` devuelve workspace, entorno, id y nombre de la key, scopes y restricción de cuentas de la key que llama.
- AC1: No devuelve el secreto ni el hash. Incluye plan, vigencia, cuotas y saldo según COM-04.
- AC2: Funciona con cualquier key válida, sin scope especial.

**IDN-03 [F]** Registro self-serve con login humano (por ejemplo magic link) y gestión de miembros. Fuera del MVP; el modelo `Workspace.ownerUserId` es la base.

### 7.2 API keys y scopes (KEY)

**KEY-01 [P]** Formato `2p_test_<secreto>` y `2p_live_<secreto>`, con al menos 32 bytes aleatorios de entropía *(propuesta)*. Se almacena solo un hash y, para mostrar, prefijo y últimos 4 caracteres.
- AC1: Ninguna lectura de la base de datos permite reconstruir el secreto.
- AC2: El prefijo de entorno coincide siempre con el entorno de la key; una key `2p_test_` nunca accede a recursos `live`.

**KEY-02 [P]** Gestión por API: `POST /v1/api-keys`, `GET /v1/api-keys`, `DELETE /v1/api-keys/:id` (revocación). Requiere scope `keys:manage`.
- AC1: El secreto se devuelve solo en la respuesta de creación.
- AC2: Una key solo crea o revoca keys de su mismo workspace y entorno.
- AC3: Una key no puede crear otra con scopes o cuentas permitidas más amplios que los suyos (`403 insufficient_scope`).
- AC4: Una key revocada deja de autenticar en ≤ 5 s *(propuesta fijada en TRD)* en REST y MCP.
- AC5: Una key no puede revocarse a sí misma si es la última con `keys:manage` del entorno (`409 last_admin_key`).

**KEY-03 [P]** Scopes mínimos:

| Scope | Permite |
|---|---|
| `accounts:read` | Listar y leer cuentas y redes |
| `accounts:manage` | Crear enlaces de conexión, marcar cuenta por defecto, desconectar |
| `posts:read` / `posts:write` | Leer / crear, editar, borrar posts; subir media |
| `publications:read` | Leer publications, attempts y eventos |
| `publish` | Publicar, programar, editar programadas, cancelar, reintentar, resolver |
| `webhooks:manage` | Gestionar webhook endpoints |
| `keys:manage` | Gestionar API keys |

- AC1: Cada endpoint y herramienta MCP declara su scope; sin él responde `403 insufficient_scope` indicando el scope requerido.
- AC2: Hay presets documentados: `agent_publisher` (`accounts:read`, `posts:read`, `posts:write`, `publications:read`, `publish`) y `read_only`.

**KEY-04 [P]** Restricción de cuentas: una key puede tener `allowedAccountIds` en lugar de `all`.
- AC1: Una key restringida solo ve en `GET /v1/accounts` las cuentas permitidas.
- AC2: Publicar o programar contra una cuenta no permitida devuelve `403 account_not_allowed_for_key` y no crea nada.
- AC3: La resolución por red (§7.5) solo considera cuentas permitidas.

**KEY-05 [M]** `expiresAt` opcional al crear la key; tras esa fecha la key no autentica (`401 api_key_expired`).

### 7.3 Entornos test y live (ENV)

**ENV-01 [P]** Aislamiento real, no solo prefijo: cuentas, posts, publications, media, webhooks, eventos, idempotency keys y API keys llevan entorno y todas las consultas filtran por el entorno de la key.
- AC1: Un id de recurso `live` consultado con key `test` (o al revés) devuelve `404 not_found`, igual que un id inexistente.
- AC2: Hay tests automáticos de aislamiento cruzado (workspace y entorno) para cada endpoint de lectura y escritura.

**ENV-02 [P]** El entorno `test` nunca contacta redes reales. Usa `SimulatedGateway`.
- AC1: Ninguna petición saliente a dominios de redes sociales se origina desde un recurso `test` (verificable en logs y en tests con red bloqueada).

**ENV-03 [P]** Cuentas simuladas en `test`, creables por `POST /v1/test/accounts` con `network` y `behavior`, y también por el flujo de conexión (que en `test` muestra una página de consentimiento simulada).
- AC1: `behavior` admite al menos `success`, `fail_permanent`, `fail_retryable_then_success`, `rate_limited`, `timeout_unknown`, `reconnect_required`.
- AC2: Cada comportamiento produce siempre la misma secuencia de estados, para pruebas deterministas de clientes.
- AC3: Las redes aparecen en `test` como `test_only` aunque en `live` estén `unavailable`.

### 7.4 Cuentas sociales y OAuth humano (ACC)

**ACC-01 [P]** `POST /v1/accounts/connect` con `network` (y `reconnectAccountId` opcional) crea una ConnectSession y devuelve `{ id, connectUrl, expiresAt }`. El llamante (agente o app) entrega el enlace al humano.
- AC1: El enlace caduca a los 15 minutos *(propuesta)* y es de un solo uso. Se almacena solo el digest de su token, se consume atómicamente al iniciar una sesión de navegador vinculada al intento y no contiene la API key. El navegador recibe una cookie corta y CSRF token para terminar el OAuth y elegir cuenta. La posesión del enlace permite iniciar la conexión, no gestionar otros recursos del workspace.
- AC2: La página del enlace muestra el nombre del workspace, el entorno y la red antes de redirigir a la red, para que el humano confirme.
- AC3: El flujo OAuth usa `state` ligado a la sesión y PKCE cuando la red lo soporte. Un `state` reutilizado o caducado falla.
- AC4: En `live`, una red `unavailable` devuelve `409 network_unavailable`.
- AC5: El `connectUrl` completo no aparece en logs ni en eventos.

**ACC-02 [P]** `GET /v1/connect-sessions/:id` devuelve `pending | completed | expired | failed`, con `accountId` al completar o `error` al fallar (por ejemplo, consentimiento denegado).

**ACC-03 [P]** Al completar el OAuth, 2post guarda las credenciales cifradas, crea o reactiva la SocialAccount y emite `account.connected`.
- AC1: Si la misma `externalAccountId` ya existe en el mismo workspace y entorno, se reutiliza la SocialAccount (mismo `id`) y se actualizan credenciales; no se crea un duplicado.
- AC2: En reconexión con `reconnectAccountId`, si la cuenta autorizada no coincide con la `externalAccountId` original, la sesión falla con `account_mismatch` y no cambia nada.
- AC3: La primera cuenta activa de una red en un entorno queda `isDefault=true`. Conectar más cuentas de esa red no cambia el default.

**ACC-04 [P]** Estados de SocialAccount: `active`, `reconnect_required`, `disconnected`.
- AC1: Un rechazo de autenticación del proveedor (por ejemplo token revocado) o un refresh fallido de forma definitiva pasa la cuenta a `reconnect_required` y emite `account.reconnect_required`.
- AC2: Las publicaciones que llegan a su turno con la cuenta en `reconnect_required` fallan con `account_reconnect_required` (no se reintentan automáticamente).
- AC3: Reconectar devuelve la cuenta a `active`.

**ACC-05 [P]** `DELETE /v1/accounts/:id` desconecta: borra credenciales, marca `disconnected`, emite `account.disconnected` y cancela las Publications cancelables de esa cuenta con `cancelReason=account_disconnected`.
- AC1: Un intento ya en curso no se aborta; su resultado se registra normalmente.
- AC2: Si era la cuenta por defecto, la red queda sin default (no se promueve otra en silencio).

**ACC-06 [P]** `PATCH /v1/accounts/:id` con `isDefault: true` la marca como default de su red y quita la marca a la anterior, en una operación atómica.

**ACC-07 [M]** 2post refresca tokens antes de que caduquen cuando la red lo permita, y debería avisar con `account.reconnect_required` con antelación cuando una cuenta con publicaciones programadas vaya a perder acceso antes de su `scheduledAt` y no pueda refrescarse.

**ACC-08 [P]** `GET /v1/accounts` filtra por `network`, `accountType` y `status`; `GET /v1/accounts/:id` devuelve la cuenta. Ninguna respuesta incluye tokens.

**ACC-09 [P]** Misma cuenta en varios workspaces. Una identidad externa puede conectarse en más de un workspace, cada uno con su propio consentimiento OAuth (D-21).
- AC1: La unicidad operativa es `(workspaceId, environment, network, externalAccountId)`. Conectar en el workspace B una cuenta que ya existe en A crea otra SocialAccount, con otro `id`.
- AC2: Ningún workspace hereda, copia ni consulta credenciales, estado o defaults de otro. Respuestas y errores nunca revelan que la cuenta existe en otro workspace.
- AC3: Las credenciales se almacenan por conexión y workspace. No se asume que sean independientes en el proveedor: si una reconexión o rotación de tokens en un workspace invalida la sesión de otro (misma app y cuenta), el afectado pasa a `reconnect_required` según ACC-04, sin que 2post propague tokens entre workspaces.
- AC4: Desconectar en un workspace no revoca la autorización upstream si esa revocación afectaría a otra conexión activa de la misma app y cuenta. La respuesta informa el efecto real.

**ACC-10 [P]** Tipo de cuenta. Toda SocialAccount tiene `accountType`: `personal` u `organization`.
- AC1: En el MVP solo se conectan cuentas `personal`: perfil de miembro en LinkedIn y cuentas de X y Bluesky.
- AC2: Contrato, esquema y matriz de capacidades admiten `organization` desde el inicio, para que habilitar páginas de LinkedIn (ACC-11) no rompa clientes ni migre identidades.
- AC3: `POST /v1/accounts/connect` acepta `accountType` opcional, por defecto `personal`. Mientras no esté habilitado, `organization` responde `409 account_type_unavailable`.

**ACC-11 [F]** Páginas de organización de LinkedIn: descubrir las páginas que administra el miembro, elegirlas en el flujo de conexión y publicar con los permisos de organización que exija LinkedIn.

### 7.5 Selección de destinos (TGT)

**TGT-01 [P]** Las operaciones de publicar y programar aceptan `targets[]`, donde cada target es `{ accountId, content? }` o `{ network, content? }`.

**TGT-02 [P]** Resolución de `{ network }`: se usa la cuenta `isDefault=true` de esa red, si está `active` y permitida para la key. En cualquier otro caso la petición falla con `422 account_selection_required` y `details.candidates` (cuentas de esa red visibles para la key, con `id`, `username`, `status`, `isDefault`).
- AC1: Nunca se elige una cuenta por orden, antigüedad ni por ser la única sin marca de default.
- AC2: La respuesta de éxito lista los `accountId` resueltos para cada target.

**TGT-03 [P]** Validación atómica: antes de crear nada, 2post valida todos los targets (cuenta existente, `active`, permitida, red disponible, contenido válido para la red). Si alguno falla, responde `422` con errores por target y no crea Publications.

**TGT-04 [P]** Un mismo `accountId` no puede aparecer dos veces en una petición (`422 duplicate_target`).

**TGT-05 [P]** Si ya existe una Publication no terminal para `(postId, accountId)`, responde `409 publication_already_active` con su id. Si existe una `published`, responde `409 already_published_to_account` salvo que la petición incluya `allowRepublish: true`.

### 7.6 Media (MED)

**MED-01 [P]** `POST /v1/media` acepta una imagen por carga binaria directa (cuerpo `image/*`) o por `multipart/form-data`. Un Post o target la referencia después por `mediaId`. La importación por URL se define en MED-07 (D-14).
- AC1: Tipos aceptados: JPEG, PNG y WebP *(propuesta; el conjunto efectivo por red se valida al publicar)*.
- AC2: Límite global de tamaño 5 MiB *(propuesta fijada en TRD)*; por encima, `413 media_too_large`.
- AC3: El tipo se detecta por contenido (magic bytes) y la imagen debe decodificarse; extensión o `Content-Type` falsos producen `422 media_invalid`.
- AC4: Se registran `sha256`, dimensiones, tamaño y tipo.

**MED-02 [P]** 2post no redimensiona, recorta ni cambia el encuadre. La única transformación es la sanitización de metadatos de MED-08. Si la imagen preparada excede el límite de una red, la publicación a esa red falla en validación con el límite concreto en el error.

**MED-03 [P]** Ownership: un `mediaId` solo es utilizable en su workspace y entorno. Referenciar uno ajeno o inexistente da `422 media_not_found`.

**MED-04 [M]** Retención: media no referenciada por ningún Post ni Publication caduca a los 7 días *(propuesta)*. Media referenciada se conserva mientras exista una Publication no terminal que la use, y al menos 30 días tras su último uso *(propuesta)*.

**MED-05 [P]** `altText` opcional por `MediaRef`, máximo 1.000 caracteres *(propuesta)*. Si la red no admite alt text, se ignora y la Publication lo indica en `warnings` (no es error, porque no altera el contenido publicado visible).

**MED-06 [F]** Video y varias imágenes.

**MED-07 [M]** Importación por URL: `POST /v1/media` con JSON `{ sourceUrl, altText? }` descarga una imagen de una URL HTTPS pública y la procesa igual que una carga.
- AC1: Solo `https` en el puerto 443 y sin credenciales en la URL. El DNS se resuelve en servidor y se rechazan direcciones loopback, privadas, link-local, de metadatos de nube y equivalentes IPv6. La conexión se fija a la IP validada.
- AC2: Como máximo 3 redirecciones *(propuesta)*, cada una revalidada con AC1. Timeout total de 10 s *(propuesta)* y corte al superar 5 MiB durante la descarga.
- AC3: El tipo se valida por contenido igual que en MED-01. Sin cookies ni cabeceras de autenticación, con un `User-Agent` identificable.
- AC4: La URL completa no se registra en logs ni eventos, porque puede ser una URL firmada; se guardan solo host y digest. Errores: `422 media_url_not_allowed`, `422 media_fetch_failed`, `413 media_too_large`.
- AC5: La descarga ocurre una vez, al importar. Publicar usa el `mediaId` resultante y nunca vuelve a descargar la URL.

**MED-08 [P]** Sanitización de metadatos por defecto (D-19). Al preparar una imagen, 2post la decodifica y la vuelve a codificar para eliminar EXIF, GPS, XMP, IPTC, comentarios y demás metadatos innecesarios para publicar.
- AC1: Antes de eliminar EXIF se aplica su orientación a los píxeles, de modo que la imagen se vea igual que el original.
- AC2: Se conserva el perfil de color ICC cuando existe, o se convierte a sRGB de forma explícita; nunca se descarta sin compensarlo.
- AC3: Se conservan formato (JPEG, PNG o WebP) y dimensiones. El TRD fija la calidad de recodificación lossy.
- AC4: El procesamiento ocurre una sola vez, al crear el `mediaId`. El resultado es inmutable y se reutiliza en todas las redes y Publications.
- AC5: Los bytes originales no se conservan tras procesar. `sha256` describe la imagen preparada y `Media` expone `metadataStripped: true`.
- AC6: Un test con una foto que contiene GPS, orientación rotada y perfil ICC verifica que la salida no tiene GPS ni EXIF, se ve con la orientación correcta y conserva el color.

### 7.7 Posts y contenido (PST)

**PST-01 [P]** `POST /v1/posts` crea un Post en `draft` con `content` y `overrides` opcionales por red. Requiere `text` no vacío o al menos una imagen.

**PST-02 [P]** `GET /v1/posts` filtra por `status`, `network` (posts con alguna Publication en esa red), `from`, `to` (sobre `createdAt`), `limit` y `cursor`. `GET /v1/posts/:id` devuelve el Post con `publicationCounts` y la lista resumida de sus Publications.

**PST-03 [P]** `PATCH /v1/posts/:id` edita `content` y `overrides` en cualquier momento. No afecta a Publications existentes (INV-02); la respuesta lo indica cuando el Post tiene Publications no terminales (`warnings: ["existing_publications_unchanged"]`).

**PST-04 [P]** `DELETE /v1/posts/:id` solo si el Post no tiene ninguna Publication; si no, `409 post_has_publications`.

**PST-05 [P]** No alteración: 2post publica el texto byte a byte como se recibió. No recorta, no normaliza Unicode, no acorta enlaces, no divide en hilos, no añade hashtags ni firmas.
- AC1: Un texto que excede el límite de la red se rechaza en validación con `content_invalid_for_network`, indicando límite, longitud calculada y método de conteo.
- AC2: Las codificaciones que exige el protocolo de la red (escapes, estructuras de enlaces o menciones) no cuentan como alteración siempre que el texto visible resultante sea idéntico. Cada adapter documenta qué codificación aplica.
- AC3: Las transformaciones que haga la propia red tras recibir el contenido (por ejemplo acortado de enlaces o tarjetas) se documentan en la matriz de capacidades, no se ocultan.

**PST-06 [P]** La validación por red usa el método de conteo de esa red (por ejemplo, peso ponderado, graphemes o code points) declarado en `GET /v1/networks`.

**PST-07 [P]** `POST /v1/posts/:id/validate` con `targets[]` devuelve, sin efectos, el contenido efectivo por target y los errores o warnings que tendría publicar. Pensado para agentes que ajustan el texto antes de publicar.

### 7.8 Publicación, programación, edición y cancelación (PUB)

**PUB-01 [P]** `POST /v1/posts/:id/publish` con `targets[]` crea una Publication por target con `scheduledAt=null` y estado `queued`. Responde `202` con las Publications creadas. No espera al proveedor.

**PUB-02 [P]** `POST /v1/posts/:id/schedule` con `targets[]` y `scheduledAt` RFC 3339 con offset explícito crea Publications en `scheduled`.
- AC1: Sin offset (`2026-10-21T09:00:00`) responde `422 scheduled_at_invalid`. `Z` es un offset válido.
- AC2: `scheduledAt` debe ser al menos 60 s posterior al reloj del servidor *(propuesta)*; si no, `422 scheduled_at_too_soon` con sugerencia de usar `publish`.
- AC3: `scheduledAt` no puede superar 365 días *(propuesta)*.
- AC4: La respuesta devuelve `scheduledAt` normalizado a UTC y el valor recibido.

**PUB-03 [P]** `POST /v1/publish` (conveniencia) recibe `content`, `targets[]` y `scheduledAt` opcional; crea el Post y sus Publications en una transacción y responde con ambos. Aplica TGT, PST e IDM igual que las operaciones sobre un Post existente.

**PUB-04 [P]** Interpretación de tiempo: el servicio solo acepta instantes inequívocos. Frases como "mañana a las 9" las resuelve el cliente o agente con la zona horaria confirmada por el usuario. La documentación de API y MCP lo explicita.

**PUB-05 [P]** Cancelación de una Publication: `POST /v1/publications/:id/cancel`.
- AC1: Tiene éxito si y solo si la Publication está en `scheduled`, `queued` o `retry_scheduled` en el momento de la transición atómica. Resultado: `cancelled`, `cancelReason=user_requested`.
- AC2: Cancelación y claim del worker son transiciones condicionales sobre la misma fila; gana la que se confirma primero. Si gana el claim, la cancelación responde `409 publication_in_progress` y no tiene efecto.
- AC3: Una respuesta `200` con `status=cancelled` garantiza que ningún intento empezará después para esa Publication.
- AC4: En `publishing`, `unknown` o terminal responde `409 publication_not_cancellable` (o `publication_in_progress`) con el estado actual. 2post no borra publicaciones ya hechas en la red.

**PUB-06 [P]** `POST /v1/posts/:id/cancel` aplica PUB-05 a cada Publication del Post y responde `200` con el resultado por Publication (`cancelled` o `not_cancellable` con estado). Es válido que unas se cancelen y otras no.

**PUB-07 [P]** Edición y reprogramación: `PATCH /v1/publications/:id` con `scheduledAt` y/o `content`, solo en estado `scheduled`, con la misma transición atómica que la cancelación.
- AC1: El contenido nuevo se valida para la red; `contentVersion` y `version` se incrementan.
- AC2: En otro estado responde `409 publication_not_editable`.
- AC3: Las reglas de PUB-02 aplican al nuevo `scheduledAt`.

**PUB-08 [P]** `GET /v1/publications` filtra por `status`, `network`, `postId`, `accountId`, `from`, `to`, `limit`, `cursor`. `GET /v1/publications/:id` incluye la lista de attempts.

**PUB-09 [P]** Retry manual: `POST /v1/publications/:id/retry`.
- AC1: Permitido desde `failed` o `missed`. Crea una nueva generación de envío (estado `queued`) con el mismo contenido congelado y reinicia el presupuesto de reintentos automáticos. Todo retry manual incrementa submissionGeneration y valida reservas vigentes; solo el que parte de unknown lleva reconocimiento de riesgo.
- AC2: Desde `unknown` exige `acknowledgeDuplicateRisk: true`, una razón auditada y además `keys:manage`; sin reconocimiento responde `409 duplicate_risk_not_acknowledged`. Crea una nueva generación de envío explícitamente autorizada que puede duplicar contenido. Conserva todos los attempts y evidencias anteriores. No está disponible por MCP ni como recovery automático.
- AC3: Desde `published` o `cancelled` responde `409 publication_not_retryable`.
- AC4: Si la cuenta no está `active`, responde `409 account_not_active`.

**PUB-10 [P]** Resolución manual de `unknown`: `POST /v1/publications/:id/resolve` con `outcome: "published"` o `outcome: "not_published"`, razón y evidencia verificable. Requiere `publish` y `keys:manage`. Para `published`, aportar `externalId`, `externalUrl` o una referencia de evidencia de confirmación; no basta un cambio de estado sin fundamento.
- AC1: `published` pasa la Publication a `published` con `resolution.by=manual`.
- AC2: `not_published` la pasa a `failed` con código `resolved_not_published`; un retry posterior no exige reconocimiento adicional. Registrar quién verificó la no publicación y con qué evidencia. La ausencia en una búsqueda no es prueba suficiente.
- AC3: Solo disponible en estado `unknown`.

### 7.9 Idempotencia de la API (IDM)

**IDM-01 [P]** El header `Idempotency-Key` es obligatorio en `publish`, `schedule`, `POST /v1/publish`, `retry` y `resolve`, y opcional en el resto de POST. Sin él, `400 idempotency_key_required`.

**IDM-02 [P]** Ámbito `(workspaceId, environment, key)`, retención 7 días *(propuesta fijada en TRD)*.
- AC1: Misma clave, misma operación normalizada y mismo cuerpo: devuelve la respuesta original (mismo status y cuerpo) sin crear nada, después de comprobar autorización vigente. REST y MCP comparten este ámbito.
- AC2: Misma clave y cuerpo distinto: `422 idempotency_key_reused`.
- AC3: Misma clave con la primera petición aún en curso: `409 idempotency_request_in_progress`.
- AC4: Si la transacción no confirmó ningún efecto local, un `5xx` no se guarda. Si la transacción confirmó pero se perdió la respuesta HTTP, la clave y su respuesta durable permanecen: el retry devuelve los mismos recursos.

**IDM-03 [P]** La idempotencia de la API garantiza como máximo un conjunto de Publications por petición lógica. **No** garantiza nada sobre lo que ocurre en la red externa; eso lo cubre §11.

## 8. Contratos REST

### 8.1 Convenciones

- Base `/v1`, JSON, `Authorization: Bearer 2p_<env>_...`.
- Ids opacos con prefijo *(propuesta)*: `ws_`, `key_`, `acc_`, `cs_`, `med_`, `post_`, `pub_`, `att_`, `whe_`, `evt_`.
- Timestamps RFC 3339 en UTC en las respuestas.
- Paginación por cursor: `limit` 1–100, por defecto 20; orden `createdAt` descendente; respuesta `{ data: [], nextCursor: string|null }`.
- Cambios compatibles: añadir campos, endpoints o valores de enum. Los clientes deben tolerar valores de enum desconocidos.
- Cada respuesta incluye `X-Request-Id`.

### 8.2 Endpoints

| Método y ruta | Scope | Fase | Requisitos |
|---|---|---|---|
| `GET /v1/me` | — | P | IDN-02 |
| `GET/POST /v1/api-keys`, `DELETE /v1/api-keys/:id` | `keys:manage` | P | KEY-02 |
| `GET /v1/networks` | `accounts:read` | P | NET-01 |
| `GET /v1/accounts`, `GET /v1/accounts/:id` | `accounts:read` | P | ACC-08 |
| `POST /v1/accounts/connect` | `accounts:manage` | P | ACC-01 |
| `GET /v1/connect-sessions/:id` | `accounts:read` | P | ACC-02 |
| `PATCH /v1/accounts/:id`, `DELETE /v1/accounts/:id` | `accounts:manage` | P | ACC-05, ACC-06 |
| `POST /v1/test/accounts` (solo `test`) | `accounts:manage` | P | ENV-03 |
| `POST /v1/media`, `GET /v1/media/:id` | `posts:write` / `posts:read` | P | MED |
| `POST/GET /v1/posts`, `GET/PATCH/DELETE /v1/posts/:id` | `posts:*` | P | PST |
| `POST /v1/posts/:id/validate` | `posts:read` | P | PST-07 |
| `POST /v1/posts/:id/publish` | `publish` | P | PUB-01 |
| `POST /v1/posts/:id/schedule` | `publish` | P | PUB-02 |
| `POST /v1/posts/:id/cancel` | `publish` | P | PUB-06 |
| `POST /v1/publish` | `publish` + `posts:write` | P | PUB-03 |
| `GET /v1/publications`, `GET /v1/publications/:id` | `publications:read` | P | PUB-08 |
| `PATCH /v1/publications/:id` | `publish` | P | PUB-07 |
| `POST /v1/publications/:id/cancel` | `publish` | P | PUB-05 |
| `POST /v1/publications/:id/retry` | `publish` | P | PUB-09 |
| `POST /v1/publications/:id/resolve` | `publish` + `keys:manage` | P | PUB-10 |
| `POST/GET /v1/webhook-endpoints`, `GET/PATCH/DELETE /v1/webhook-endpoints/:id` | `webhooks:manage` | P | WHK |
| `POST /v1/webhook-endpoints/:id/rotate-secret` | `webhooks:manage` | M | WHK-06 |
| `GET /v1/events`, `GET /v1/events/:id` | `publications:read` | M | WHK-08 |

Rutas no API (HTML mínimo, sin login): página del enlace de conexión, callback OAuth por red, página de resultado de la conexión.

### 8.3 Ejemplo: publicar un Post existente

```http
POST /v1/posts/post_123/publish
Authorization: Bearer 2p_live_...
Idempotency-Key: 6f1c0e7e-1b5a-4f0e-9a51-2d1f3b0e8c11

{
  "targets": [
    { "accountId": "acc_x1" },
    { "network": "linkedin", "content": { "text": "Versión para LinkedIn", "media": [] } }
  ]
}
```

```http
202 Accepted
{
  "post": { "id": "post_123", "status": "publishing" },
  "publications": [
    { "id": "pub_a", "socialAccountId": "acc_x1", "network": "x", "status": "queued", "scheduledAt": null },
    { "id": "pub_b", "socialAccountId": "acc_li7", "network": "linkedin", "status": "queued", "scheduledAt": null,
      "resolvedFrom": { "network": "linkedin", "rule": "default_account" } }
  ]
}
```

### 8.4 Modelo de error (ERR)

**ERR-01 [P]** Toda respuesta de error usa:

```json
{
  "error": {
    "type": "invalid_request | authentication | permission | not_found | conflict | rate_limited | provider | internal",
    "code": "account_selection_required",
    "message": "Texto legible y accionable",
    "retryable": false,
    "details": {},
    "requestId": "req_..."
  }
}
```

- AC1: `code` es estable y documentado; `message` puede cambiar.
- AC2: Los errores de validación por target incluyen `details.targets[]` con índice, `code` y datos concretos (límite, longitud, candidatos).

**ERR-02 [P]** `Publication.lastError` y `PublicationAttempt.error` usan `{ code, message, attribution, retryable, providerCode?, providerMessage?, httpStatus?, occurredAt }`. `providerMessage` se muestra saneado (sin tokens ni cabeceras), no se oculta.

**ERR-03 [P]** `attribution` ∈ `platform | provider | account | content`, usado por las métricas (§15).

Catálogo inicial de códigos (el TRD lo completa):

| Ámbito | Códigos |
|---|---|
| Auth y permisos | `unauthenticated`, `api_key_revoked`, `api_key_expired`, `insufficient_scope`, `account_not_allowed_for_key`, `last_admin_key` |
| Validación | `validation_failed`, `content_invalid_for_network`, `media_invalid`, `media_too_large`, `media_not_found`, `media_url_not_allowed`, `media_fetch_failed`, `scheduled_at_invalid`, `scheduled_at_too_soon`, `duplicate_target` |
| Selección | `account_selection_required`, `account_not_found`, `account_not_active`, `network_unavailable`, `account_mismatch`, `account_type_unavailable`, `network_quota_exceeded` |
| Conflictos | `publication_already_active`, `already_published_to_account`, `publication_in_progress`, `publication_not_cancellable`, `publication_not_editable`, `publication_not_retryable`, `duplicate_risk_not_acknowledged`, `post_has_publications` |
| Idempotencia | `idempotency_key_required`, `idempotency_key_reused`, `idempotency_request_in_progress` |
| Ejecución | `provider_rejected`, `provider_rate_limited`, `provider_unavailable`, `provider_duplicate_content`, `account_reconnect_required`, `account_disconnected`, `permission_denied`, `retries_exhausted`, `outcome_unknown`, `resolved_not_published`, `schedule_missed`, `provider_budget_exhausted` |
| Comercial | `plan_limit_exceeded`, `commercial_balance_insufficient` |
| Otros | `not_found`, `rate_limited`, `internal_error` |

## 9. Estados

### 9.1 Publication

| Estado | Significado | Terminal |
|---|---|---|
| `scheduled` | Espera a `scheduledAt` | No |
| `queued` | Vencida o inmediata, esperando worker. Puede ser transitorio y no observarse | No |
| `publishing` | Un worker la ha reclamado; hay un intento en curso | No |
| `retry_scheduled` | El último intento falló con evidencia de no publicación y es reintentable; espera `nextAttemptAt` | No |
| `unknown` | El último intento pudo haber publicado o no. Sin envíos automáticos. Reconciliación en curso o agotada | No (requiere atención) |
| `published` | Publicación confirmada, con externalId, externalUrl o evidencia verificable; publishedAt obligatorio | Sí |
| `failed` | No publicada con fallo definitivo, reintentos agotados o resuelta como no publicada | Sí (admite retry manual) |
| `cancelled` | Cancelada antes de cualquier claim pendiente | Sí |
| `missed` | Programada cuyo primer envío no empezó dentro de la ventana de tolerancia (EXE-11). Nunca se envió | Sí (admite retry manual) |

Transiciones permitidas:

| Desde | Hacia | Disparador |
|---|---|---|
| (nuevo) | `queued` | publish |
| (nuevo) | `scheduled` | schedule |
| `scheduled` | `queued` | llega `scheduledAt` (reloj de la base de datos) |
| `scheduled` | `scheduled` | PATCH (reprogramación o contenido) |
| `scheduled`, `queued`, `retry_scheduled` | `cancelled` | cancelación o desconexión de cuenta |
| `queued`, `retry_scheduled` (vencida) | `publishing` | claim del worker |
| `publishing` | `queued` | lease perdido **antes** de `dispatchStartedAt` |
| `publishing` | `publishing` | aceptación remota con referencia; actualizar fase provider_processing y seguir por lectura |
| `publishing` | `published` | éxito confirmado del proveedor |
| `publishing` | `retry_scheduled` | fallo con evidencia de no publicación, reintentable, presupuesto disponible |
| `publishing` | `failed` | fallo definitivo, o reintentable sin presupuesto (`retries_exhausted`) |
| `publishing` | `unknown` | resultado ambiguo (§11.3) |
| `unknown` | `published` | reconciliación encuentra la publicación, o resolve `published` |
| `unknown` | `failed` | resolve `not_published` |
| `unknown` | `queued` | retry con `acknowledgeDuplicateRisk`, o retry automático solo si `idempotentCreate` verificado |
| `failed` | `queued` | retry manual |
| `scheduled`, `queued` (programada, sin dispatch) | `missed` | vence la ventana de tolerancia antes del primer `dispatchStartedAt` (EXE-11) |
| `missed` | `queued` | retry manual, sin riesgo de duplicado porque nunca se envió |

Cualquier otra transición es un error de programación y debe rechazarse.

**STA-01 [P]** Cada transición incrementa `Publication.version`, se persiste en la misma transacción que el Event de WHK-07 correspondiente al estado destino.

### 9.2 PublicationAttempt

| Campo | Regla |
|---|---|
| `claimedAt` | Al reclamar |
| `dispatchStartedAt` | Se persiste **antes** de la primera llamada al proveedor que puede tener efecto público |
| `outcome` | `null` durante ejecución o procesamiento remoto; al cerrar: `succeeded`, `failed`, `unknown`, `abandoned` (lease perdido antes de `dispatchStartedAt`) |
| `error` | Según ERR-02 |

**STA-02 [P]** Un attempt se crea una vez y se completa mediante compare-and-set. Una vez terminal, sus timestamps y outcome son inmutables; un retry crea otro attempt. Reconciliación y resolución manual añaden evidencia separada y actualizan Publication, sin reescribir el resultado histórico `unknown`.

### 9.3 Estado agregado del Post

`Post.status` se calcula aplicando estas reglas en orden; gana la primera que cumple. Cubre todas las combinaciones.

| # | Condición sobre las Publications del Post | `Post.status` |
|---|---|---|
| 1 | No hay ninguna | `draft` |
| 2 | Alguna en `queued`, `publishing` o `retry_scheduled` | `publishing` |
| 3 | Alguna en `scheduled` | `scheduled` |
| 4 | Alguna en `unknown` | `unknown` |
| 5 | Todas `published` | `published` |
| 6 | Todas `cancelled` | `cancelled` |
| 7 | Al menos una `published` (resto `failed`/`missed`/`cancelled`) | `partially_published` |
| 8 | Resto: al menos una `failed` o `missed`, ninguna `published` | `failed` |

**STA-03 [P]** El Post expone `publicationCounts` por estado para que el cliente no dependa solo del agregado.
- AC1: Tests de propiedad generan combinaciones arbitrarias de estados y verifican que el resultado coincide con la tabla y que siempre hay un resultado.

Ejemplos: `{published, scheduled}` → `scheduled`; `{published, unknown}` → `unknown`; `{published, cancelled}` → `partially_published`; `{failed, cancelled}` → `failed`; `{missed, cancelled}` → `failed`; `{retry_scheduled, published}` → `publishing`.

## 10. MCP

### 10.1 Transporte e identidad

**MCP-01 [P]** Servidor MCP remoto sobre Streamable HTTP en `/mcp`, servido por el mismo proceso API, sin estado de sesión obligatorio entre peticiones. No se soporta el transporte HTTP+SSE antiguo.
- AC1: La versión de la especificación MCP soportada se fija en el TRD y se publica en la documentación.

**MCP-02 [P]** Autenticación con la misma API key: `Authorization: Bearer 2p_<env>_...`. MCP no tiene permisos propios; cada herramienta exige el scope de su operación REST equivalente.
- AC1: Una petición sin key válida falla antes de listar herramientas.

**MCP-03 [P]** Identidad del llamante: la key identifica workspace, entorno, scopes y cuentas permitidas. El `clientInfo` del handshake MCP se registra como metadato **autodeclarado** en eventos y logs y nunca se usa para autorizar.
- AC1: Los eventos generados por MCP tienen `actor = { type: "api_key", apiKeyId, channel: "mcp", client: { name, version, selfReported: true } }`.
- AC2: Se recomienda una key por agente (por ejemplo "muse-prod") con preset `agent_publisher` y `allowedAccountIds`.

**MCP-04 [M]** Debería listar solo las herramientas permitidas por los scopes de la key.

**MCP-05 [F]** Autorización OAuth de MCP para clientes que no permiten configurar un header (conectores alojados). Depende de G-05.

**MCP-06 [F]** Transporte stdio mediante un proxy local que llame a la API REST. No se nombra paquete hasta decidirlo.

### 10.2 Herramientas

| Herramienta | Equivale a | Scope | Tipo |
|---|---|---|---|
| `whoami` | `GET /v1/me` | — | lectura |
| `list_networks` | `GET /v1/networks` | `accounts:read` | lectura |
| `list_accounts` | `GET /v1/accounts` | `accounts:read` | lectura |
| `create_connect_link` | `POST /v1/accounts/connect` | `accounts:manage` | escritura |
| `get_connect_session` | `GET /v1/connect-sessions/:id` | `accounts:read` | lectura |
| `upload_image` [M] | `POST /v1/media` (base64, límite menor *(propuesta: 2 MB)*) | `posts:write` | escritura |
| `import_image` [M] | `POST /v1/media` con `sourceUrl` (MED-07) | `posts:write` | escritura |
| `create_post`, `update_post` | `POST`/`PATCH /v1/posts` | `posts:write` | escritura |
| `get_post`, `list_posts` | `GET /v1/posts...` | `posts:read` | lectura |
| `validate_post` | `POST /v1/posts/:id/validate` | `posts:read` | lectura |
| `publish_post` | `POST /v1/posts/:id/publish` | `publish` | escritura con efecto externo |
| `schedule_post` | `POST /v1/posts/:id/schedule` | `publish` | escritura con efecto externo |
| `publish` | `POST /v1/publish` | `publish` + `posts:write` | escritura con efecto externo |
| `cancel_post`, `cancel_publication` | cancel | `publish` | escritura |
| `update_scheduled_publication` | `PATCH /v1/publications/:id` | `publish` | escritura |
| `get_publication`, `list_publications` | `GET /v1/publications...` | `publications:read` | lectura |
| `retry_publication` | `POST /v1/publications/:id/retry` **solo desde `failed` o `missed`** | `publish` | escritura con efecto externo |

**MCP-07 [P]** Las herramientas con efecto externo exigen `idempotencyKey` como argumento y lo pasan como `Idempotency-Key`.
- AC1: Repetir la misma llamada con la misma clave no crea Publications adicionales.
- AC2: La descripción de la herramienta indica al agente reutilizar la clave al reintentar la misma intención.

**MCP-08 [P]** Las herramientas de publicar y programar aceptan `targets` con `accountId` o `network` (TGT-02) y overrides por target. La selección ambigua devuelve el error `account_selection_required` con candidatos para que el agente pregunte al usuario.

**MCP-09 [P]** `schedule_post` y `publish` con fecha exigen RFC 3339 con offset. Su descripción indica confirmar la zona horaria con el usuario antes de convertir expresiones relativas.

**MCP-10 [P]** La resolución de `unknown` (`resolve`) y el retry desde `unknown` no se exponen por MCP en el MVP: requieren REST, idealmente con un humano. Un agente que encuentra `unknown` recibe en el resultado el estado, la explicación y la acción recomendada ("pedir al usuario que compruebe la cuenta").

**MCP-11 [P]** Cada resultado de herramienta incluye datos estructurados (con esquema de salida si la versión de MCP fijada lo soporta) y un resumen textual breve. Los errores usan el mismo `code` que REST.

**MCP-12 [P]** Las herramientas declaran anotaciones de comportamiento (solo lectura, destructiva, idempotente, efecto en mundo abierto) si la versión de MCP fijada las define.

### 10.3 Matriz de verificación por cliente

**MCP-13 [P]** No se afirma compatibilidad con ningún cliente sin una fila verificada. Estado inicial:

| Cliente | Transporte usado | Auth usada | Lista herramientas | Publica | Programa | Maneja error de selección | Versión y fecha | Estado |
|---|---|---|---|---|---|---|---|---|
| Muse (agente personal) | ? | ? | — | — | — | — | — | Prueba de compatibilidad separada (G-05) |
| Grokbot (agente personal) | ? | ? | — | — | — | — | — | Prueba de compatibilidad separada (G-05) |
| Cliente de Claude (a elegir) | ? | ? | — | — | — | — | — | No verificado |
| Cliente de ChatGPT (a elegir) | ? | ? | — | — | — | — | — | No verificado |
| MCP Inspector u otro cliente de referencia | Streamable HTTP | Header | — | — | — | — | — | Primera verificación del piloto |

- AC1: El piloto requiere el cliente de referencia verificado. El MVP requiere además un cliente MCP remoto conocido, por ejemplo un cliente de Claude o ChatGPT que admita headers. Muse, Grokbot y otros agentes personales se prueban y documentan por separado; su resultado no bloquea el MVP (D-17).

## 11. Ejecución, reintentos y resultados desconocidos (EXE)

### 11.1 Garantía honesta

**EXE-01 [P]** 2post garantiza:

1. Como máximo un conjunto de Publications por petición idempotente (IDM).
2. Como máximo una Publication activa por `(post, cuenta)` (INV-03).
3. Que ningún envío automático se repite si hay posibilidad de que el anterior haya tenido efecto (INV-05).
4. Que nunca se envía antes de `scheduledAt` (INV-04).

2post **no** garantiza exactly-once en la red externa. Si un proveedor recibe la petición y la respuesta se pierde, el resultado es `unknown` y se reconcilia; nunca se resuelve con un reintento ciego. La documentación pública lo dice con estas palabras.

### 11.2 Ciclo de un intento

**EXE-02 [P]** Scheduler y workers usan PostgreSQL como cola y reloj.
- AC1: Una Publication es reclamable si está en `queued`, o en `scheduled`/`retry_scheduled` con `scheduledAt`/`nextAttemptAt` ≤ `now()` de la base de datos. Una programada fuera de la ventana de EXE-11 no se reclama: pasa a `missed`.
- AC2: El claim es una transición condicional que solo un worker puede ganar, crea el attempt con `claimedAt` y fija un lease *(propuesta: 120 s)*.
- AC3: Antes de la primera llamada con posible efecto público, el worker persiste `dispatchStartedAt` y confirma la transacción. Pasos previos sin efecto público (refresh de token, subida de media al proveedor) pueden ocurrir antes.
- AC4: Tras la respuesta, persiste el resultado, la transición y el evento en una transacción.
- AC5: Como máximo un intento en curso por SocialAccount *(propuesta)*, para respetar límites del proveedor y orden de llegada.

**EXE-03 [P]** Recuperación de workers caídos: un proceso de mantenimiento examina attempts con lease vencido.
- AC1: Sin `dispatchStartedAt`: attempt `abandoned`, Publication vuelve a `queued`. No consume presupuesto de reintentos, pero más de 3 abandonos seguidos *(propuesta)* la pasan a `failed` con `internal_error` y alerta.
- AC2: Con `dispatchStartedAt` y sin respuesta ni referencia de seguimiento: attempt `unknown`, Publication `unknown`. Si ya existe referencia durable de procesamiento, recuperar polling de solo lectura sin reenvío. Al agotar el plazo verificado de seguimiento, cerrar como `unknown`.

### 11.3 Clasificación de resultados

**EXE-04 [P]** Cada adapter clasifica cada resultado con esta tabla. Ante duda, se elige la fila más conservadora (`unknown`).

| Situación | Evidencia de efecto externo | Resultado del attempt | Estado siguiente |
|---|---|---|---|
| Fallo antes de `dispatchStartedAt` (token inválido, refresh rechazado, media rechazada por el proveedor) | Ninguna | `failed` | `failed` si es definitivo; `retry_scheduled` si es transitorio |
| Error de conexión antes de enviar la petición (DNS, conexión rechazada, TLS) | Ninguna | `failed`, reintentable | `retry_scheduled` |
| `429` u otra respuesta explícita de rate limit | Rechazo explícito | `failed`, reintentable | `retry_scheduled` respetando `Retry-After` |
| `4xx` de validación, permisos o contenido duplicado | Rechazo explícito | `failed`, definitivo | `failed` |
| `401` o token revocado | Rechazo explícito | `failed`, definitivo | `failed`; cuenta a `reconnect_required` |
| `5xx` | Ambigua salvo que el adapter tenga verificado para esa red que ese código implica no creación | `unknown` (por defecto) o `failed` reintentable | `unknown` o `retry_scheduled` |
| Timeout o conexión cortada después de enviar | Ambigua | `unknown` | `unknown` |
| Caída del worker con `dispatchStartedAt` | Ambigua | `unknown` | `unknown` |
| Respuesta que confirma publicación según el contrato verificado de la red | Efecto confirmado | `succeeded` | `published`; guardar referencia o evidencia suficiente y advertir si falta ID |
| `2xx` con aceptación o procesamiento remoto y referencia consultable | Todavía pendiente de confirmación | Sin outcome terminal | Sigue `publishing`, fase `provider_processing`; hacer polling de solo lectura, nunca otro create |
| `2xx` sin confirmación ni referencia suficiente | Ambigua | `unknown` | `unknown` |

**EXE-05 [P]** La clasificación de cada código por red se documenta en el adapter y se cubre con tests usando respuestas grabadas o simuladas.

### 11.4 Reintentos automáticos

**EXE-06 [P]** Solo se reintenta automáticamente un attempt `failed` reintentable (evidencia de no publicación).
- AC1: Calendario de reintentos tras el intento inicial: 5 s, 30 s, 2 min, 10 min (máximo 5 attempts no abandonados), con jitter ±20 % *(propuesta)*.
- AC2: `Retry-After` del proveedor prevalece si es mayor que el siguiente intervalo.
- AC3: Si `Retry-After` supera 60 min *(propuesta)* o se agotan los attempts, la Publication pasa a `failed` con `retries_exhausted` (o `provider_rate_limited`) y el último error del proveedor visible.
- AC4: `nextAttemptAt` es visible en la API.

### 11.5 Reconciliación

**EXE-07 [P]** Al entrar en `unknown`, si la red declara `reconciliation: supported` en su matriz verificada, 2post busca evidencia de la publicación en la cuenta.
- AC1: Ventana de búsqueda *(propuesta)*: a 1 min, 5 min, 15 min y 60 min del `dispatchStartedAt`.
- AC2: La reconciliación automática exige identidad remota estable, identificador determinista verificado o correlación única aportada por el proveedor. Misma cuenta, texto y ventana temporal producen candidatos para revisión humana, nunca confirmación automática: otro cliente podría haber publicado lo mismo.
- AC3: Si encuentra evidencia: `published` con `resolution.by=reconciliation`.
- AC4: Si no la encuentra al final de la ventana: sigue `unknown` con `reconciliation.status=exhausted`. Ausencia de evidencia no se trata como prueba de no publicación.
- AC5: Si la red no soporta reconciliación: `reconciliation.status=unsupported` desde el inicio.

**EXE-08 [P]** `unknown` sale solo por reconciliación positiva, resolve manual (PUB-10), retry reconocido (PUB-09 AC2) o retry automático en redes con `idempotentCreate` verificado (EXE-09).

**EXE-09 [M]** Si una red ofrece creación idempotente verificable (por ejemplo, un identificador de registro elegido por el cliente que el servidor rechaza si ya existe), el adapter debería usarla y declarar `idempotentCreate: true`. Solo entonces un `unknown` puede reintentarse automáticamente con el mismo identificador. Hipótesis por verificar en G-03 para Bluesky; no asumida para X ni LinkedIn.

### 11.6 Puntualidad

**EXE-10 [P]** El scheduler revisa Publications vencidas con frecuencia suficiente para cumplir MET-03 *(propuesta: cada ≤ 5 s)*, con un único reloj de referencia (base de datos).

**EXE-11 [P]** Ventana de tolerancia de 15 minutos (D-18) para Publications programadas cuyo primer envío se retrasa, sea por caída, saturación o límites del proveedor:

| Retraso del primer envío respecto a `scheduledAt` | Comportamiento |
|---|---|
| Hasta 15 min | Se publica. Si el retraso supera 60 s, queda `late: true` |
| Más de 15 min | No se publica. Pasa a `missed` con `lastError.code=schedule_missed` y el retraso medido |
| Publicación inmediata ya encolada | No aplica la ventana. Se reconcilia su ejecución antes de decidir: sin `dispatchStartedAt` se envía normalmente; con `dispatchStartedAt` y sin resultado sigue EXE-03 AC2 |

- AC1: `late` es un atributo, no un estado. Una Publication puede terminar `published` con `late: true`. El flag se fija al primer dispatch y es true solo si su retraso supera 60 segundos. En las programadas, `lateBySeconds` registra siempre `dispatchStartedAt − scheduledAt` del primer envío.
- AC2: La ventana se evalúa con el reloj de la base de datos al reclamar. Un claim ganado dentro de la ventana completa su envío aunque el dispatch empiece segundos después del límite; si pierde el lease antes del dispatch, se vuelve a evaluar.
- AC3: La ventana solo afecta al primer envío. Los reintentos automáticos de una Publication ya intentada siguen EXE-06.
- AC4: `missed` emite `publication.missed` y alerta al operador. Su `attribution` es `platform`, o `provider` si el retraso se debió a límites del proveedor. Admite retry manual (PUB-09), que publica de inmediato sin reconocimiento de riesgo.
- AC5: Tras restaurar un backup se aplica la misma regla, después de reconciliar los envíos inciertos.

Ejemplo con `scheduledAt=09:00`: primer dispatch a las 09:00:20 implica `late=false` y `lateBySeconds=20`; a las 09:05 implica `late=true` y 300 segundos. Si el primer claim se intenta a las 09:20, pasa a `missed` y no hay dispatch ni `lateBySeconds`. `late` mide cuándo empezó el envío, no cuándo la red hizo visible el contenido. Los retries no reescriben esa medición.

**EXE-12 [F]** Parámetro `missedSchedulePolicy: "publish" | "skip"`, por Publication o por workspace, para que el consumidor elija publicar tarde sin límite o descartar. El MVP se comporta como `skip` pasados 15 minutos.

## 12. Integraciones: SocialGateway y redes (GW, NET)

### 12.1 SocialGateway

**GW-01 [P]** El dominio y los casos de uso solo dependen del puerto `SocialGateway`. Ningún módulo de dominio importa SDKs de redes ni del Social SDK.
- AC1: Una regla de dependencias automatizada (lint o test de arquitectura) falla si el dominio importa un paquete de proveedor.

**GW-02 [P]** El puerto cubre, como mínimo: iniciar OAuth, completar OAuth, refrescar credenciales, obtener perfil, validar contenido según capacidades, subir media, crear publicación, clasificar resultado (EXE-04) y buscar evidencia para reconciliación (si se soporta). Cada operación devuelve resultados tipados, no excepciones del proveedor.

**GW-03 [P]** Adapters: `SimulatedGateway` (entorno `test`) y, en `live`, un adapter por red que envuelve el adapter directo de Social SDK de esa red con credenciales de aplicación propias (D-16). Un adapter propio contra la API oficial solo se admite como decisión registrada si el SDK no cubre una capacidad verificada.

### 12.2 Social SDK

**GW-04 [P]** Social SDK es [`@opencoredev/social-sdk`](https://github.com/opencoredev/social-sdk), de OpenCore, con licencia MIT. Unifica operaciones sobre varias redes en dos modalidades: adapters directos, que llaman a las APIs oficiales con credenciales propias, y backends gestionados, que delegan en terceros. 2post lo usa desde el MVP **solo con adapters directos**, detrás de `SocialGateway` (D-16).
- AC1: No se configuran backends gestionados (Zernio, Post for Me, PostFast, Postiz, Buffer u otros), para conservar el control de las integraciones y de los costos de terceros.
- AC2: El SDK exige Node.js 22.12 o superior y es ESM-only. No provee PostgreSQL, colas, scheduler ni facturación; esas responsabilidades siguen en 2post.
- AC3: Se fija la versión exacta en el lockfile. Antes de habilitar cada red, pruebas de integración con esa versión comprueban sus capacidades efectivas: conexión, texto, imagen, errores y clasificación EXE-04. Es la única validación necesaria sobre el SDK; las puertas de acceso de cada red (G-01 a G-03) siguen aplicando.
- AC4: Que una red figure en el SDK no implica disponibilidad en 2post. El SDK incluye adapters directos para X, LinkedIn, Bluesky, Instagram, Threads, TikTok y YouTube; el MVP habilita solo X, LinkedIn y Bluesky.

### 12.3 Matriz de capacidades por red

**NET-01 [P]** `GET /v1/networks` devuelve por red y entorno:

```
{
  network: "x" | "linkedin" | "bluesky",
  availability: "available" | "unavailable" | "test_only",
  accountTypes: ["personal"],           // "organization" llega con ACC-11 (LinkedIn)
  text: { maxLength, countingMethod, allowEmptyWithMedia },
  media: { maxImages, mimeTypes, maxBytes, altText: boolean },
  reconciliation: "supported" | "unsupported",
  idempotentCreate: boolean,
  providerTransformations: string[],    // lo que la red cambia tras recibir el contenido
  cost: { model, operations[], priceVerifiedAt } | null, // X: pago por consumo (COST-01)
  verifiedAt, sourceUrls[]
}
```

- AC1: Ningún valor de esta matriz se publica para `live` sin `verifiedAt` y al menos una `sourceUrl` oficial.
- AC2: La validación de contenido (PST-06, MED-02) usa estos mismos valores, no copias en código.

**NET-02 [P]** Criterio para que una red pase a `available` en `live` (además de su puerta G-01/02/03):

1. Conexión OAuth completa desde una cuenta real, incluida reconexión.
2. Publicación real de texto y de texto con imagen, con `externalUrl` correcta.
3. Errores de token inválido, contenido inválido y rate limit observados o reproducidos, y clasificados.
4. Capacidad de reconciliación e `idempotentCreate` determinadas.
5. Límites documentados con enlace oficial y fecha.

**NET-03 [M]** Bluesky publica los enlaces del texto como rich-text facets para que sean clicables (D-24).
- AC1: Se usan los facets de URL que el adapter directo de Social SDK genera automáticamente. El texto visible no cambia (PST-05 AC2).
- AC2: Los offsets de los facets son bytes UTF-8, no índices de string de JavaScript. Las pruebas cubren emojis de 4 bytes, secuencias ZWJ, acentos combinados y texto CJK antes y después del enlace, y verifican que cada facet cubre exactamente la URL.
- AC3: La validación usa los límites verificados en G-03. La documentación del SDK indica 300 graphemes y 3.000 bytes UTF-8 a 2026-10-21.
- AC4: Menciones y hashtags quedan fuera del MVP: una mención exige un DID resuelto, y el texto `@handle` solo no produce facet.

### 12.4 Costos de proveedor (COST)

**COST-01 [P]** X cobra por consumo con créditos, sin suscripción mensual obligatoria. Crear un post con URL cuesta mucho más que uno sin URL: a 2026-10-21, USD 0,200 frente a 0,015 por petición según la tabla oficial. 2post registra por intento la operación facturable estimada y su coste según una tabla de precios versionada y fechada, configurable sin deploy.
- AC1: `validate` y la Publication de X incluyen el `costClass` estimado (`post` o `post_with_url`) como dato informativo, sin alterar el contenido.
- AC2: El coste registrado es una estimación. Se concilia con el consumo real de la consola del proveedor y se informa la diferencia.

**COST-02 [P]** 2post hosted usa la cuenta de desarrollador de 2post. Presupuesto inicial aprobado: compra de USD 50 en créditos, sin recarga automática. Tope de consola USD 100 por ciclo y tope interno USD 90, con alertas internas a USD 45, 72 y 90. El máximo ejecutable es el menor entre saldo financiado disponible y presupuesto restante, descontando reservas; USD 90 no equivale a haber comprado ese saldo. Los incentivos promocionales no forman parte del presupuesto garantizado. Ver [supuestos y cálculo](COMMERCIAL-PLAN.md).
- AC1: Al alcanzar el tope, X deja de aceptar nuevas Publications con `409 provider_budget_exhausted`, y las aceptadas sin dispatch fallan con ese código; admiten retry manual cuando se amplíe el presupuesto. Ningún envío ya autorizado se aborta.

**COST-03 [P]** Cuota por workspace de publicaciones en X por mes UTC, configurable por el operador. Se reserva al aceptar, incluidas las programadas, y se libera si la Publication termina sin dispatch (`cancelled`, `missed` o `failed` antes de enviar). Exceder la cuota responde `409 network_quota_exceeded` sin crear ninguna Publication del lote.

**COST-04 [P]** 2post self-hosted: el operador configura sus propias credenciales de aplicación por red, incluidas las de X, y asume directamente el consumo. Ninguna distribución incluye credenciales de la app hosted de 2post. Presupuesto y cuotas usan el mismo mecanismo con valores del operador.

**COST-05 [P]** X no tiene publicaciones live incluidas en el plan gratuito de 2post. Builder y Pro habilitan X con saldo prepago adicional: USD 0,02 por publicación confirmada sin URL y USD 0,25 con URL. El operador registra el pago externo antes de acreditar saldo. La tarifa se confirma al aceptar cada destino; no se modifica texto para cambiar su categoría. Cuota inicial de seguridad: 50 Publications de X por workspace y mes UTC, ampliable por el operador. Los design partners pueden tener una concesión de 50 sin cargo durante el piloto, con fecha final y presupuesto global compartido.
- AC1: Saldo, cuota y permiso comercial se validan para todo el lote antes de crear Publications. Saldo insuficiente devuelve `409 commercial_balance_insufficient`; plan no habilitado, `409 plan_limit_exceeded`.
- AC2: Se reserva saldo al aceptar, se cobra una vez al confirmar `published` y se libera ante fallo definitivo o cancelación sin publicación. `unknown` conserva la reserva hasta resolución. Retry automático no genera otro cargo al cliente; su coste upstream lo asume 2post.
- AC3: Un retry con riesgo reconocido desde `unknown` es una nueva generación con reserva y posible cargo propios. Antes de autorizarlo se informa que pueden confirmarse y cobrarse ambas generaciones. `test` nunca consume saldo ni cuota live.

### 12.5 Lanzamiento comercial (COM)

**COM-01 [P]** El lanzamiento hosted ofrece Sandbox gratis, Builder por USD 9/mes y Pro por USD 29/mes. Sandbox incluye 2 cuentas y 30 Publications live mensuales compartidas entre LinkedIn y Bluesky; Builder, 5 cuentas y 300; Pro, 25 cuentas y 2.000. X se paga aparte según COST-05. `test` no tiene cargo ni cuota comercial mensual, pero conserva rate limits y límites técnicos. El [plan comercial](COMMERCIAL-PLAN.md) fija unidades, períodos y operación manual.

**COM-02 [P]** El operador activa el período pagado y sus límites después de confirmar un pago externo. No existe una tool MCP ni una API key de cliente que pueda acreditar saldo, cambiar plan o marcar un pago como confirmado. Repetir una referencia de pago no duplica la activación ni el saldo. Toda concesión, ajuste y devolución queda auditada.

**COM-03 [P]** Los límites se reservan atómicamente para impedir sobreconsumo concurrente. Cada Publication es un destino lógico: publicar en dos cuentas no-X consume dos unidades incluidas. Las reservas se imputan al mes UTC de aceptación, incluso en programadas futuras; al primer dispatch pasan a consumo y los retries de esa misma Publication no duplican la unidad incluida. Cancelar, fallar o vencer sin dispatch libera la reserva original. Cambiar plan o caducar no borra datos ni revoca trabajos ya aceptados con reserva válida. Se impiden nuevas operaciones que excedan el derecho vigente.

**COM-04 [P]** `GET /v1/me` incluye plan, fecha de vigencia, límites y consumo por entorno, saldo disponible y reservado de X. La configuración comercial no amplía scopes ni acceso a cuentas. Los listados e inspección de resultados siguen disponibles al vencer el período pagado; reintentos manuales requieren permiso y reserva vigentes.

## 13. Webhooks y eventos (WHK)

**WHK-01 [P]** `POST /v1/webhook-endpoints` con `url` y `events[]` (o `["*"]`). Devuelve el secreto de firma (`whsec_...`) solo en la creación.

**WHK-02 [P]** Protección de destinos:
- AC1: Solo `https`. No se siguen redirecciones.
- AC2: Se resuelve el DNS en cada entrega y se rechazan direcciones loopback, privadas, link-local, de metadatos de nube y equivalentes IPv6; la conexión se hace a la IP validada.
- AC3: Timeout de 10 s *(propuesta)*; el cuerpo de respuesta se ignora y se trunca en logs.

**WHK-03 [P]** Envelope:

```json
{
  "id": "evt_...",
  "type": "publication.published",
  "apiVersion": "v1",
  "createdAt": "2026-10-21T09:00:04Z",
  "workspaceId": "ws_...",
  "environment": "live",
  "actor": { "type": "system" },
  "data": { "object": { "id": "pub_...", "version": 2, "status": "published" } }
}
```

El snapshot del evento contiene metadata pública mínima y versión; no incluye texto completo ni bytes de media por defecto. El consumidor autorizado puede consultar el recurso.

**WHK-04 [P]** Firma: cabecera `2post-Signature: t=<unix>,v1=<hex>`, donde `v1 = HMAC-SHA256(secret, "<t>.<cuerpo exacto>")`, y cabecera `2post-Event-Id`.
- AC1: La documentación incluye verificación de referencia y recomienda rechazar `t` con más de 5 min de desviación.

**WHK-05 [P]** Entrega at-least-once.
- AC1: Éxito = respuesta `2xx`. Cualquier otra cosa o timeout se reintenta con backoff exponencial y jitter hasta 8 entregas en ~24 h *(propuesta)*.
- AC2: El mismo evento puede llegar más de una vez y fuera de orden. Los consumidores deduplican por `id` y ordenan por `data.object.version`. La documentación lo dice explícitamente.
- AC3: Un evento se encola en la misma transacción que la transición que lo origina (no se pierde si el proceso cae tras confirmar).
- AC4: Tras 3 días *(propuesta)* de fallos continuos, el endpoint pasa a `disabled` y lo indica en la API.

**WHK-06 [M]** Rotación de secreto con solapamiento: durante 24 h *(propuesta)* se firma con ambos secretos (dos valores `v1`).

**WHK-07 [P]** Eventos:

| Evento | Cuándo |
|---|---|
| `post.created` | Se crea un Post |
| `publication.scheduled` | Publication creada o reprogramada en `scheduled` |
| `publication.queued` | Publication pasa a `queued`: creación inmediata, vencimiento, retry o recuperación tras lease perdido |
| `publication.publishing` | Claim del worker |
| `publication.retry_scheduled` | Fallo reintentable con siguiente intento programado |
| `publication.unknown` | Resultado ambiguo |
| `publication.published` | Publicada (incluye `resolution` si vino de reconciliación o resolve, y `late` en programadas) |
| `publication.failed` | Fallo definitivo, agotado o resuelta como no publicada |
| `publication.cancelled` | Cancelada (incluye `cancelReason`) |
| `publication.missed` | Programada no enviada por superar la ventana de tolerancia (EXE-11) |
| `account.connected` | Cuenta conectada o reconectada |
| `account.reconnect_required` | Cuenta requiere reconexión |
| `account.disconnected` | Cuenta desconectada |

**WHK-08 [M]** `GET /v1/events` con `type`, `after` (cursor) y `limit` permite recuperar eventos perdidos. Retención 30 días *(propuesta)*.

## 14. Rate limits, seguridad y observabilidad

### 14.1 Rate limits (RL)

**RL-01 [P]** Límites por API key, por workspace y entorno, por SocialAccount y por app de proveedor. Valores iniciales *(propuesta)*: 120 peticiones/min por key; 30 operaciones de publicación/min por key; 300 peticiones/min por workspace; un intento concurrente por SocialAccount (EXE-02 AC5); cupo por proveedor configurado según su documentación verificada.
- AC1: Superar un límite de API responde `429 rate_limited` con `Retry-After` y cabeceras de límite restante.
- AC2: Los límites de proveedor no rechazan peticiones de API: retrasan el dispatch (la Publication sigue `queued` o `retry_scheduled`) y son visibles en `nextAttemptAt`.

### 14.2 Seguridad (SEC)

**SEC-01 [P]** Credenciales de redes cifradas en reposo con una clave gestionada fuera de la base de datos; descifrado solo en el worker y en el flujo OAuth.

**SEC-02 [P]** API keys y secretos de webhook nunca se almacenan en claro (los de webhook se guardan cifrados porque hacen falta para firmar).

**SEC-03 [P]** Aislamiento por workspace y entorno derivado siempre de la key autenticada, nunca de parámetros del cuerpo o la ruta (INV-01, ENV-01).

**SEC-04 [P]** Redacción en logs y errores: cabecera `Authorization`, tokens OAuth, códigos OAuth, `state`, secretos, `connectUrl`, cuerpos crudos de proveedor que contengan credenciales. El texto de posts se registra como longitud y hash, no completo *(propuesta)*.
- AC1: Un test inyecta secretos conocidos en todos los flujos y comprueba que no aparecen en logs, eventos ni respuestas.

**SEC-05 [P]** Auditoría mínima: cada Event lleva `actor` (`api_key` con `apiKeyId` y `channel: rest|mcp`, `connect_session`, `system` u `operator`).

### 14.3 Observabilidad (OBS)

**OBS-01 [P]** Logs estructurados con `requestId`, `jobId`, `workspaceId`, `environment`, `postId`, `publicationId`, `attemptId`, `socialAccountId`, `network`, `provider` cuando apliquen.

**OBS-02 [P]** Métricas técnicas: profundidad de cola, Publications vencidas sin reclamar, edad del vencimiento más antiguo, leases vencidos, tasa por estado y red, entregas de webhook pendientes.

**OBS-03 [M]** Alertas: Publication vencida sin reclamar > 60 s *(propuesta)*; cualquier `unknown` o `missed`; tasa de `failed` por red por encima de la línea base; endpoint de webhook deshabilitado; umbrales de presupuesto de proveedor (COST-02).

### 14.4 Retención y borrado (RET)

**RET-01 [P]** Políticas de retención propias por clase de dato (D-22). Son las propuestas del TRD, aceptadas por el founder para el MVP, y no un pronunciamiento sobre obligaciones legales de conservación.

| Clase de dato | Retención |
|---|---|
| Registro de Post y Publication (IDs, estado, cuenta, `externalId`, `externalUrl`, timestamps) | Mientras exista el workspace o hasta un borrado solicitado |
| Texto y media de Post y Publication | 90 días tras el último destino terminal, salvo Post vigente editable, Publication no terminal o `unknown` sin resolver |
| Attempts e historial operativo | 180 días |
| Eventos del feed (`GET /v1/events`) | 30 días |
| Logs técnicos | 30 días |
| Registros de idempotencia | 7 días |
| Media no referenciada / uploads incompletos | 7 días / 24 h |

**RET-02 [P]** Borrado a solicitud del owner. En el MVP lo ejecuta el operador con un comando auditado, para el workspace completo o para recursos concretos (Post, media, cuenta).
- AC1: Borra texto de Posts y Publications, media almacenada y credenciales sociales. Si se borra el workspace, revoca además sus keys y endpoints.
- AC2: Cancela primero las Publications cancelables y espera el outcome de un intento ya autorizado. Una `unknown` sin resolver exige que el owner confirme que se pierde la evidencia.
- AC3: Conserva solo un registro mínimo sin contenido: IDs, actor, fecha y alcance del borrado.
- AC4: No borra publicaciones ya hechas en las redes, y la respuesta lo indica.
- AC5: Los backups cifrados caducan según su propia retención *(propuesta: 35 días)*. Tras un restore se reaplican los borrados registrados antes de habilitar workers.

**RET-03 [P]** Logs, eventos y errores no almacenan tokens, API keys, secretos ni contenido sensible innecesario (SEC-04, INV-07).

### 14.5 Despliegue (DEP)

**DEP-01 [P]** 2post hosted se aloja en AWS, región US East (N. Virginia, `us-east-1`) (D-23). API, PostgreSQL, workers y almacenamiento primario de objetos van en esa misma región cuando sea posible.

**DEP-02 [P]** Credenciales sociales cifradas con claves gestionadas fuera de la base de datos (AWS KMS en hosted). Base de datos, backups, snapshots y objetos también se cifran en reposo.

**DEP-03 [P]** 2post no promete residencia de datos en un país. La región es una elección operativa inicial, no un requisito de Social SDK. Publicaciones y credenciales interactúan necesariamente con proveedores externos fuera de ese control.

**DEP-04 [P]** La arquitectura no impide una expansión regional: región como configuración, sin supuestos de región única en el código, y datos y claves de objeto agrupados por workspace. No se crean estructuras regionales hasta diseñar esa expansión (PR-07).

## 15. Métricas de éxito (MET)

Reglas comunes:

- MET-01/02 cuentan cada Publication una sola vez en la cohorte de firstOutcomeAt, fijado al primer published, failed, missed o unknown. La evaluación usa el estado más reciente al corte y reporta ventana observada. El TRD detalla su persistencia.

- Fuente: timestamps de la base de datos (Publication, PublicationAttempt, Event), no relojes de workers.
- Se calculan por red y en total, separando `test` y `live`. Solo `live` cuenta para objetivos.
- Una métrica con menos de 100 muestras en su ventana se informa como "muestra insuficiente", no como cumplida.
- En el piloto se miden; en el MVP se comprometen. No son contratos comerciales.

| ID | Métrica | Definición | Ventana | Objetivo MVP |
|---|---|---|---|---|
| MET-01 | Ejecución correcta atribuible a 2post | Numerador: Publications `published`. Denominador: Publications que llegaron a `published`, `failed`, `missed` o `unknown` en la ventana, excluyendo las `failed` con `attribution` ∈ {`provider`, `account`, `content`}. `unknown` sin resolver cuenta como no exitosa. Excluye `cancelled` | 28 días móviles | ≥ 99 % |
| MET-02 | Éxito bruto | `published` / (`published` + `failed` + `missed` + `unknown`), sin exclusiones. Se publica junto a MET-01 para no ocultar fallos de proveedor | 28 días móviles | Sin objetivo; se informa |
| MET-03 | Puntualidad de programación | `dispatchStartedAt` del primer attempt − `scheduledAt`, para Publications programadas despachadas. Las tasas de `late` y `missed` se informan aparte | 7 días móviles | p99 ≤ 30 s; ningún valor < 0 |
| MET-04 | Latencia de publicación inmediata | `completedAt` del attempt exitoso − `createdAt` de la Publication, para publicaciones inmediatas que terminan en `published` en el primer attempt. Se informa aparte la variante con reintentos | 7 días móviles | p95 < 30 s por red |
| MET-05 | Latencia de operaciones internas | Tiempo en servidor desde recepción hasta respuesta, endpoints `/v1` excepto `POST /v1/media`, incluidas respuestas de error | 7 días móviles | p95 < 300 ms bajo la carga de referencia |
| MET-06 | Tasa de `unknown` | Publications que entraron en `unknown` / Publications con al menos un attempt con `dispatchStartedAt` | 28 días móviles | < 0,5 % *(propuesta)* |
| MET-07 | Duplicados causados por reintento automático | Casos confirmados de dos publicaciones externas por una sola Publication sin retry reconocido | Acumulado | 0 |
| MET-08 | Entrega de webhooks | Eventos entregados con `2xx` en ≤ 5 min desde `createdAt` / eventos con endpoint activo suscrito | 7 días móviles | ≥ 99 % *(propuesta)*, excluyendo endpoints `disabled` |

**MET-09 [M]** Carga de referencia para MET-03 y MET-05 *(propuesta; el TRD la fija)*: 20 peticiones/s sostenidas durante 10 min contra endpoints internos, y 500 Publications con el mismo `scheduledAt` en `test`.

**MET-10 [P]** Invariante, no métrica: cualquier attempt con `dispatchStartedAt < scheduledAt` es un incidente de severidad máxima. Hay una consulta de verificación continua y un test de concurrencia.

## 16. Roadmap y extensibilidad mínima

### 16.1 Futuro previsto (no MVP)

| Tema | Notas |
|---|---|
| Plataforma de pago self-serve | Registro, login humano, checkout y renovaciones automáticas. El MVP ya vende acceso con cobro externo, activación manual, cuotas y saldo por Workspace; la automatización se añade después. |
| Panel web | Conectar cuentas, gestionar keys, inspeccionar estado y resolver `unknown`. Consume la misma API. El MVP no lo requiere porque los enlaces de conexión cubren el único paso humano. |
| Asistencia de contenido por IA | Ver §16.2 |
| SDKs y CLI | SDK TypeScript, después Python, y CLI sobre la API pública |
| Redes | Threads, Instagram, TikTok y YouTube (Social SDK ya incluye sus adapters directos); páginas de organización de LinkedIn (ACC-11) |
| Formatos | Varias imágenes, video |
| Colaboración | Equipos, roles, aprobaciones |
| Otros | Analytics, plantillas, recurrencia, borrado en la red, `missedSchedulePolicy` (EXE-12) |

### 16.2 Asistencia de contenido por IA (futuro)

- Una suscripción de chat (ChatGPT Plus/Pro, Claude Pro/Max) **no** es una credencial de API utilizable por 2post. No se asume acceso "trae tu suscripción".
- Hoy el usuario ya puede usar su producto de chat o agente como cliente MCP de 2post: el agente redacta y 2post publica. Ese camino no requiere que 2post llame a ningún modelo.
- La asistencia integrada futura llamaría a APIs comerciales de modelos (OpenAI API, Anthropic API u otras) con una key aportada por el workspace o pagada por 2post, con consentimiento explícito, presupuesto por workspace y registro de uso.
- Una sugerencia de IA nunca se aplica en silencio: el usuario o agente la acepta y queda como contenido normal del Post o del target. La Publication guarda solo el contenido final.

### 16.3 Extensibilidad que sí entra en el MVP

**EXT-01 [P]** Todo recurso tiene `workspaceId`; ninguna consulta asume un único workspace.

**EXT-02 [P]** Módulos con límites claros: identidad y keys, cuentas, contenido y media, publicación y ejecución, gateway, webhooks y eventos, MCP. El acceso comercial y su registro de uso quedan separados de la ejecución social. La asistencia IA y la facturación automatizada se añaden sin modificar las reglas de envío.

**EXT-03 [P]** `Content` y `MediaRef` admiten crecer (más medios, tipo `video`) sin romper el contrato, porque `media` ya es lista y `type` ya existe.

## 17. Escenarios de aceptación end-to-end

Cada escenario se ejecuta por REST y repetido por MCP salvo que se indique.

| ID | Escenario | Fase |
|---|---|---|
| E2E-01 | Operador ejecuta bootstrap; `GET /v1/me` con la key `test` y con la `live` devuelve el entorno correcto | P |
| E2E-02 | Crear una key `agent_publisher` restringida a una cuenta; la key no ve ni publica en otras cuentas | P |
| E2E-03 | En `test`: crear cuentas simuladas en las tres redes, crear Post con texto e imagen, publicar a las tres, todas `published`, Post `published`, webhook firmado recibido y verificado | P |
| E2E-04 | En `test`: programar a +2 min; cancelar una Publication antes del vencimiento; la otra se publica sin adelantarse a `scheduledAt`; Post `partially_published` | P |
| E2E-05 | En `test`: cuenta `timeout_unknown` → Publication `unknown`, sin segundo envío automático; resolve `not_published` → `failed`; retry → `published` | P |
| E2E-06 | En `test`: cuenta `fail_retryable_then_success` → `retry_scheduled` → `published`, dos attempts visibles | P |
| E2E-07 | Repetir `publish` con la misma `Idempotency-Key`: misma respuesta, ninguna Publication extra; con cuerpo distinto: `idempotency_key_reused` | P |
| E2E-08 | Target `{ network: "x" }` con dos cuentas X sin default visible para la key → `account_selection_required` con candidatos; nada creado | P |
| E2E-09 | Texto que excede el límite de una red → `422` sin crear Publications para ninguna red; el texto no se recorta | P |
| E2E-10 | En `live`, para cada red disponible: conectar cuenta real por enlace, listar, publicar texto con imagen, `externalUrl` abre la publicación, programar una nueva, consultar resultado, recibir webhook | P (≥ 1 red), M (X, LinkedIn y Bluesky) |
| E2E-11 | Desde un cliente MCP verificado: `list_accounts`, `create_post`, `publish_post`, `schedule_post`, `get_publication`, `cancel_post` | P (cliente de referencia), M (+ cliente MCP remoto conocido; agentes personales aparte, G-05) |
| E2E-12 | Aislamiento: ids de otro workspace o del otro entorno devuelven `404` en todos los endpoints | P |
| E2E-13 | En `test`: programadas que vencen durante una caída simulada; reanudar a los 10 min → `published` con `late: true`; reanudar a los 20 min → `missed` sin llamada al proveedor; retry manual → `published` | P |
| E2E-14 | Foto con GPS, orientación EXIF rotada y perfil ICC subida por binario, multipart y URL → misma apariencia, sin EXIF ni GPS, un solo `mediaId` reutilizado en las tres redes | P (binario y multipart), M (URL) |
| E2E-15 | Importación por URL hacia loopback, IP privada, metadata de nube, redirect a IP privada y DNS rebinding → rechazada sin conexión al destino interno | M |
| E2E-16 | La misma cuenta externa conectada en dos workspaces → dos SocialAccounts distintas; ninguna key de un workspace ve, usa ni revela la del otro | P |
| E2E-17 | En `test`: cuota de X del workspace agotada → `409 network_quota_exceeded` sin crear Publications; tope global → `provider_budget_exhausted` | P |
| E2E-18 | Bluesky: texto con emojis y acentos antes de un enlace → facet sobre los bytes UTF-8 exactos de la URL y texto visible idéntico | M |

**Criterio de MVP:** E2E-01 a E2E-18 superados en su fase M, las tres redes en `available` en `live`, métricas MET-01 a MET-08 medidas durante al menos 14 días *(propuesta)* con objetivos cumplidos o desviaciones aceptadas por el founder.

**Criterio de piloto:** escenarios [P] superados, al menos una red en `live`, métricas instrumentadas.

**E2E-19 [P]** Acceso comercial: Sandbox rechaza X sin crear destinos parciales; el lote concurrente no excede cuentas, unidades ni saldo; pago externo repetido no acredita dos veces; `test` no factura; retries y resoluciones respetan las reservas; al vencer el plan, lectura y trabajos aceptados siguen disponibles.

## 18. Decisiones registradas

D-01 a D-13 son decisiones rutinarias del refinamiento, propuestas explícitas que el founder puede revertir. D-14 y D-15 (revisadas) y D-16 a D-26 son decisiones del founder del 2026-10-21. D-27 aplica su instrucción de conservar Fastify si el anuncio no justifica cambiar.

| ID | Decisión | Motivo |
|---|---|---|
| D-01 | Bootstrap por comando de operador; sin registro público en el MVP | El registro público es parte del SaaS futuro y añade auth humana que el MVP no necesita |
| D-02 | Conexión de cuentas por enlace de un solo uso creado por API | Permite a agentes y automatizaciones iniciar el OAuth humano sin dashboard |
| D-03 | `test` usa un gateway simulado con comportamientos deterministas; nunca redes reales | Las redes no ofrecen sandboxes comparables; aísla datos y efectos |
| D-04 | Scopes y restricción por cuenta desde el piloto | Los agentes necesitan permiso mínimo; añadirlo después rompería keys emitidas |
| D-05 | Selección por red solo vía cuenta default explícita y visible; la primera cuenta conectada de una red es default | Evita selección silenciosa sin obligar a pasar ids en el caso de una sola cuenta |
| D-06 | Validación atómica de todos los targets; ningún recorte ni normalización | Predecible para agentes; cumple "no alterar contenido" |
| D-07 | Publication (destino lógico) separada de PublicationAttempt (cada ejecución) | Historia de reintentos y diagnóstico sin reescribir estado |
| D-08 | Bluesky: preferir OAuth de AT Protocol; app password solo si OAuth no es viable, como decisión explícita | Evita custodiar contraseñas de usuario. Pendiente de G-03 |
| D-09 | Estado `unknown` no terminal con reconciliación; retry desde `unknown` solo con reconocimiento explícito y nunca por MCP en el MVP | Un agente no debe poder convertir una ambigüedad en duplicado |
| D-10 | Cancelación gana solo antes del claim | Una transición atómica simple; tras el claim, el resultado lo decide el intento |
| D-11 | PostgreSQL como cola y reloj; sin broker externo en el MVP | Simplicidad operativa del monolito; una sola fuente de verdad |
| D-12 | Webhooks con firma HMAC y outbox transaccional; feed `GET /v1/events` | At-least-once real y recuperación sin soporte manual |
| D-13 | MCP sobre Streamable HTTP con API key en header; OAuth de MCP y stdio en futuro | Mismo modelo de auth que REST; lo demás depende de clientes no verificados |
| D-14 | Media por carga binaria o multipart, URL HTTPS pública con protección SSRF y referencia `mediaId`. Sustituye la propuesta anterior de solo carga directa | 2post sirve a agentes personales y plataformas, que generan o alojan imágenes de formas distintas |
| D-15 | LinkedIn: solo perfiles personales en el MVP; `accountType` (`personal`/`organization`) modelado desde el inicio | Las páginas exigen permisos adicionales; modelarlo ya evita migrar identidades al habilitarlas (ACC-10, ACC-11) |
| D-16 | Social SDK (`@opencoredev/social-sdk`) desde el MVP, solo con adapters directos y detrás de `SocialGateway` | Conserva el control de las integraciones y de los costos de terceros |
| D-17 | 2post es agnóstico al agente. Muse y Grokbot no bloquean el MVP; se valida con un cliente MCP remoto conocido y la compatibilidad de cada agente se documenta aparte | Son agentes personales; el contrato MCP no depende de uno concreto |
| D-18 | Ventana de tolerancia de 15 min para programadas: `late` como atributo, `missed` como estado terminal; `missedSchedulePolicy` en el futuro | Publicar mucho más tarde de lo previsto puede ser peor que no publicar; el consumidor ve el retraso |
| D-19 | Eliminar EXIF, GPS y metadatos innecesarios por defecto, recodificando una sola vez y conservando orientación y color | Privacidad; OWASP recomienda reescribir imágenes para eliminar contenido innecesario del archivo original |
| D-20 | X con pago por consumo: en hosted paga la cuenta de desarrollador de 2post con presupuesto, cuotas y topes; en self-hosted, el operador con sus credenciales | No hay tier mensual obligatorio y los posts con URL cuestan mucho más |
| D-21 | La misma cuenta externa puede conectarse en varios workspaces, con autorización y credenciales independientes | Productos distintos sobre 2post; la identidad externa nunca concede acceso cruzado |
| D-22 | Retención por clase de dato con los plazos del TRD, separada para Post/Publication y logs, con borrado a solicitud | El ciclo de vida del contenido no es el de los logs |
| D-23 | Producción en AWS `us-east-1`, componentes en la misma región, sin promesa de residencia | Elección operativa inicial con latencia y coste simples |
| D-24 | Bluesky: facets de enlace generados por el adapter de Social SDK, con offsets UTF-8 | URLs clicables sin alterar el texto visible |
| D-25 | Acceso de pago desde el lanzamiento, Sandbox con 0 X live, Builder USD 9 y Pro USD 29, X con prepago separado; piloto gratuito acotado | Validar disposición a pagar sin construir una plataforma de facturación |
| D-26 | Node.js 24 LTS; aplicación NestJS CommonJS con TypeScript nodenext e importación dinámica del SDK ESM en su adapter | Compatibilidad sin convertir todo el backend a ESM |
| D-27 | Conservar platform-fastify; reevaluar platform-node tras publicación estable, compatibilidad y medición representativa | El anuncio y el benchmark de Hello world no demuestran disponibilidad ni ventaja en 2post |

## 19. Preguntas resueltas y pendientes

El founder respondió Q-01 a Q-11 el 2026-10-21.

| ID | Pregunta | Resolución | Estado |
|---|---|---|---|
| Q-01 | ¿Qué es exactamente Social SDK? | `@opencoredev/social-sdk`, solo adapters directos detrás de `SocialGateway` (D-16, GW-04) | Resuelta. Falta verificar capacidades por red (G-04) |
| Q-02 | ¿Qué son Muse y Grokbot y qué MCP soportan? | Agentes personales. 2post es agnóstico y no bloquea el MVP por ellos (D-17, MCP-13) | Resuelta. Compatibilidad aparte (G-05) |
| Q-03 | ¿Qué hacer con programadas vencidas durante una caída? | Ventana de 15 min: `late` hasta ese límite, `missed` después; `missedSchedulePolicy` futuro (D-18, EXE-11, EXE-12) | Resuelta |
| Q-04 | ¿Eliminar EXIF de las imágenes? | Sí, por defecto, conservando orientación y color (D-19, MED-08) | Resuelta |
| Q-05 | ¿Importación de imágenes por URL? | Binario/multipart, URL HTTPS pública y `mediaId` (D-14, MED-01, MED-07) | Resuelta |
| Q-06 | ¿Páginas de organización de LinkedIn en el MVP? | No; `accountType` desde el inicio y páginas después (D-15, ACC-10, ACC-11) | Resuelta |
| Q-07 | ¿Quién paga la API de X y qué tier se necesita? | Hosted usa créditos de 2post: USD 50 iniciales, topes USD 90 interno y 100 consola, Sandbox con 0 X live, X prepago en planes de pago (COST y COM) | Presupuesto y oferta inicial resueltos. Pendientes compra, configuración y verificación real de acceso, cuotas y costos auxiliares |
| Q-08 | ¿La misma cuenta social en varios workspaces? | Sí, con autorización independiente por workspace (D-21, ACC-09) | Resuelta |
| Q-09 | Retención de attempts, eventos y logs | Plazos del TRD por clase de dato, borrado a solicitud y logs sin secretos (D-22, RET) | Resuelta para el MVP. No es una revisión legal |
| Q-10 | ¿Dónde desplegar 2post? | AWS `us-east-1`, sin promesa de residencia (D-23, DEP) | Resuelta |
| Q-11 | ¿Bluesky debe generar facets para los enlaces? | Sí, con offsets UTF-8; menciones y hashtags después (D-24, NET-03) | Resuelta |

## 20. Trazabilidad con el brief

| Tema del brief | Dónde se resuelve |
|---|---|
| Bootstrap, keys, scopes, test/live | §7.1–7.3, D-01, D-03, D-04 |
| Conexión y reconexión de cuentas | §7.4, D-02 |
| Varias cuentas por red, `POST /publish` | §7.5, PUB-03, D-05 |
| Overrides y contenido congelado | §6.2, INV-02 |
| Post frente a Publication y retries | §6.1, §9, D-07 |
| Estados originales refinados | §9.1, §9.3 |
| Idempotencia y exactly-once | §7.9, §11.1 |
| Retry 5s/30s/2m/10m, Retry-After, jitter | §11.4 |
| Cancelación | PUB-05, PUB-06, D-10 |
| Edición y reprogramación | PST-03, PUB-07 |
| Media segura, EXIF e importación por URL | §7.6, D-14, D-19 |
| Costos de X, presupuesto y self-hosted | §12.4, D-20 |
| Despliegue, retención y borrado | §14.4, §14.5, D-22, D-23 |
| MCP: tools, transportes, identidad, clientes | §10 |
| Webhooks firmados y protegidos | §13 |
| Rate limits, logs sin secretos | §14 |
| Métricas con denominadores y ventanas | §15 |
| Aceptación E2E y piloto | §4.2, §17 |
| Social SDK y redes sujetas a verificación | §4.3, §12 |
| Futuro pago e IA | §16 |
