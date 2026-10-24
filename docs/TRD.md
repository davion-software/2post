# 2post: requisitos y diseño técnico

Versión: 0.3. Fecha: 2026-10-21. Estado: diseño objetivo. El 2026-10-22 se incorporó la base ejecutable descrita en el README; los contratos de producto siguen pendientes.

Fuentes: [PRD](PRD.md), [brief del founder](references/PRODUCT-BRIEF.md) y [verificación de integraciones](references/INTEGRATION-RESEARCH.md). El PRD gobierna alcance y aceptación. Este documento define contratos y mecanismos. [Backend Schema](BACKEND-SCHEMA.md) gobierna persistencia. [Implementation Plan](IMPLEMENTATION-PLAN.md) gobierna el orden de entrega.

## 1. Decisiones y límites

El stack acordado es TypeScript sobre Node.js 24 LTS, NestJS con platform-fastify y PostgreSQL, con monolito modular y dos procesos del mismo código: API y worker. REST y MCP ejecutan los mismos casos de uso. El dominio no importa NestJS, ORM, Social SDK ni DTOs de terceros.

Drizzle ya está incorporado para migraciones y acceso SQL tipado. pg-boss para jobs sobre PostgreSQL y almacenamiento privado compatible con S3 para imágenes siguen como propuestas por validar en P0. En hosted, los objetos van a Amazon S3 en `us-east-1`; el core depende de `ObjectStore`, de modo que self-hosted puede usar otro backend compatible. No se añade Redis ni un servicio por red al piloto.

Social SDK es [`@opencoredev/social-sdk`](https://github.com/opencoredev/social-sdk), decidido por el founder (PRD D-16). Se usa desde el MVP solo con adapters directos y credenciales de aplicación propias; no se instalan ni configuran backends gestionados. El paquete exige Node.js 22.12 o superior y es ESM-only, sin build CommonJS. La aplicación NestJS se emite como CommonJS (`"type": "commonjs"`), con `module` y `moduleResolution` en `nodenext`. Un provider asíncrono carga el SDK mediante `await import("@opencoredev/social-sdk")` exclusivamente dentro de `adapters/social-sdk/`. La salida compilada conserva `import()` nativo; no usar una configuración que lo transforme en `require()`. Los imports exclusivos de tipos ESM, si hacen falta, usan `resolution-mode: import` y no salen del adapter. El dominio recibe tipos propios de `SocialGateway`. P0 verifica el build y el arranque compilado en Node.js 24, incluida carga ESM con top-level await; no basta ejecutar con tsx. Se fija versión exacta en lockfile, y cada red se habilita tras pruebas de integración de sus capacidades efectivas. Ver [evidencia](references/INTEGRATION-RESEARCH.md). No importar tipos del paquete fuera de `adapters/social-sdk/`.

MCP permite que un agente use el producto; no requiere un modelo de IA dentro de 2post. Generación y refinamiento de contenido, elección de modelo, facturación automatizada y plataforma editorial quedan fuera de esta implementación. El acceso de pago con cobro externo y activación manual sí entra en el MVP (PRD COM).

Producción hosted en AWS `us-east-1` (PRD DEP-01). Propuesta: API y worker como servicios de contenedor separados (por ejemplo ECS Fargate), Amazon RDS for PostgreSQL con backups cifrados y recuperación puntual, S3 privado para media, KMS para la clave raíz de cifrado de credenciales y Secrets Manager para secretos de aplicación, todo en la misma región. Los servicios concretos se fijan en P8; el código solo depende de puertos y configuración.

### 1.1 Adapter HTTP y criterio de revisión

Se conserva `@nestjs/platform-fastify`. Verificación del 2026-10-21: la release estable consultada es NestJS 12.2.0 y el registro npm responde 404 para `@nestjs/platform-node`. El anuncio aportado por el founder habla de una próxima minor release. La captura compara 55.618,97 req/s de Nest platform-node con 52.613,34 de Nest platform-fastify, una diferencia del 5,71 % en ese test de Hello world. No mide el backend de 2post. Fastify sin Nest aparece como otra fila y no es la configuración propuesta.

Para cambiar después se exige versión oficial estable y mantenida, documentación y compatibilidad comprobada con MCP Streamable HTTP, streaming y abort, OAuth y cookies, raw body, multipart con límites, CORS, proxy confiable, observabilidad y shutdown. Medir los endpoints de 2post con autenticación, validación, PostgreSQL y concurrencia representativa. No prometer que cambiar `main.ts` basta si hay plugins específicos. Aislar los plugins HTTP en el bootstrap sin crear una segunda abstracción de framework. Ver [fuentes y comprobación reproducible](references/INTEGRATION-RESEARCH.md).

### 1.2 Compilación y pruebas

Fijar el patch de Node.js 24, TypeScript y NestJS en P0 y el lockfile. Mantener `experimentalDecorators` y `emitDecoratorMetadata` para la inyección y validación que los requieran. Vitest cubre dominio, contratos e integración. Las pruebas de Nest deben usar código compilado por TypeScript o una transformación que emita metadata compatible y esté probada en P0; el transpile predeterminado de esbuild no sustituye esa comprobación. El build de producción y su arranque son puertas independientes del test runner.

## 2. Estructura de código prevista

Actualización del 2026-10-24: las funcionalidades agrupan casos de uso e interfaces dentro de su módulo. La infraestructura común conserva sus carpetas compartidas. [ARCHITECTURE.md](ARCHITECTURE.md) describe las reglas verificadas por Fallow y el ejemplo de `operations`. Vite+ proporciona las herramientas de lint, formato y pruebas; la compilación Nest conserva la metadata de decoradores.

Un paquete Node con dos entrypoints evita duplicar reglas entre procesos:

```text
src/
  entrypoints/api.ts
  entrypoints/worker.ts
  modules/
    commercial-access/
    identity/
    workspaces/
    api-keys/
    connections/
    accounts/
    media/
    posts/
    publications/
    webhooks/
  domain/
  application/
  adapters/
    postgres/
    jobs/
    object-store/
    social-sdk/        # solo adapters directos
    mock-social/
  interfaces/
    rest/
    mcp/
    control/
  observability/
db/migrations/
test/{unit,integration,contract,e2e}/
```

La estructura completa es objetivo; el README describe el subconjunto existente. Los módulos se organizan por responsabilidad. `domain` contiene estados y reglas compartidas, y `application` los contratos comunes. No crear capas vacías por módulo. Una dependencia cruza módulos mediante un caso de uso o puerto explícito.

API acepta intención, valida, persiste y responde. Worker ejecuta publicaciones, polling de resultados, reconciliación, refresh de credenciales y webhooks. Se despliegan por separado, con límites de conexiones y concurrencia. El [adapter oficial de Fastify](https://docs.nestjs.com/techniques/performance) es la base HTTP; validar el SDK MCP elegido sobre él.

## 3. Contexto de autorización

Todo caso de uso recibe un `ActorContext` construido en servidor: `principalId`, `workspaceId`, `environment`, `credentialId`, `scopes` y `requestId`. Ningún `workspaceId` del body concede acceso. Los filtros por tenant se aplican a lecturas, mutaciones, jobs, media, cursores y entrega de eventos.

Una API key pertenece a un workspace y un entorno, y puede tener restricciones de cuentas. Se genera con CSPRNG y al menos 256 bits de entropía; se almacena su digest HMAC-SHA-256 con pepper fuera de DB, identificador de versión del pepper y un prefijo no secreto para localizarla. Se muestra una sola vez. La comparación es constante en tiempo. Revocación y expiración se comprueban en cada solicitud; caché, si existe, no puede demorar la revocación más de 5 segundos.

Scopes MVP según KEY-03: `accounts:read`, `accounts:manage`, `posts:read`, `posts:write`, `publications:read`, `publish`, `webhooks:manage` y `keys:manage`. El preset `agent_publisher` no incluye administración de cuentas, keys ni webhooks. Gestión de keys exige `keys:manage`; una key hija nunca amplía scopes ni cuentas de su creadora. No permitir revocar la última key administrativa de un entorno. Resolución manual y retry de unknown exigen además `keys:manage`.

`test` usa exclusivamente adapters deterministas y cuentas sintéticas. `live` usa cuentas autorizadas reales. El entorno se obtiene de la credencial. Prefijo de key, claims y filas deben coincidir. Un intento test nunca carga tokens live ni envía a redes reales. Separar bases y secretos de staging y producción además de este límite lógico.

El piloto es por invitación. Un comando operativo autenticado crea User, Workspace y dos keys administrativas, test y live, entregadas una sola vez al owner. Repetir no recupera secretos. Gestionar otras keys usa REST y no requiere login web ni registro público. El owner conserva sus keys administrativas fuera de la configuración del agente y usa keys restringidas por consumidor. El único HTML obligatorio es la conexión social y su resultado. La verificación de identidad y entrega inicial corresponden al operador del piloto; no hay un endpoint público que acepte un email para apropiarse de un workspace.

## 4. Conectar, reconectar y desconectar cuentas

La conexión siempre culmina con consentimiento humano en el proveedor, incluso si un agente inicia la solicitud. REST devuelve una URL de conexión; ningún caller aporta access tokens sociales en el body de publicación.

1. Validar actor y permiso, red habilitada, callback registrado y URL de retorno permitida. La API devuelve un connectUrl de un solo uso, con token aleatorio cuyo digest se guarda. La página muestra workspace, entorno y red. Un GET no consume el enlace: la confirmación humana por POST lo consume atómicamente, crea una sesión de navegador de 15 minutos ligada al intento y aplica CSRF. Un link scanner no debe gastar el enlace. No incluir la API key en URL ni cookie.
2. Persistir intento con state aleatorio de un solo uso, expiración de 15 minutos y principal, workspace y entorno de origen. PKCE y material privado dependen del protocolo real del proveedor.
3. Redirigir al proveedor. El callback valida state, expiración y binding al intento. Reclama el intercambio del código de forma durable antes de hacerlo.
4. Descubrir cuentas en servidor. Si hay varias, el humano elige entre las descubiertas; no aceptar un ID arbitrario del navegador como prueba de ownership.
5. Guardar selección y credenciales cifradas. Reintentos de callback reutilizan descubrimiento ya guardado; no repiten ciegamente códigos de un solo uso.
6. Emitir `account.connected`. Una reconexión reemplaza credenciales con control de versión y conserva el `SocialAccount.id` si la identidad externa es la misma.

Una conexión puede administrar varias cuentas, pero nunca cruza workspace ni entorno. La misma identidad externa puede conectarse en otro workspace con su propio OAuth (PRD ACC-09); esa conexión tiene credenciales propias y no se enlaza con la primera. No se asume independencia en el proveedor: algunos comparten o rotan tokens por app y cuenta, así que un refresh o reconexión en un workspace puede invalidar la sesión de otro, que pasa a reconnect_required al detectarlo. Bluesky puede requerir una sesión con claves adicionales, por lo que se cifra un payload versionado del adapter, no solo dos columnas de token. El refresh está serializado por conexión con lease durable y compare-and-set de revisión. Si se pierde la respuesta de una rotación de token, marcar `reconnect_required` cuando no haya recuperación segura.

Desconectar marca la cuenta no utilizable y cancela publicaciones aún cancelables de esa cuenta. Si otras cuentas comparten la conexión, no borrar sus credenciales. Solo se destruye una credencial al no tener más grants activos. Una revocación remota se intenta únicamente si la red la soporta y no existe otra conexión activa de la misma app e identidad externa en otro workspace (comprobación interna que nunca se expone), y su resultado se informa sin prometer que desconexión local equivale a revocación upstream.

## 5. Puertos del proveedor

Los contratos siguientes describen el diseño, no tipos existentes:

```text
SocialGateway
  capabilities(account) -> CapabilityManifest
  validate(snapshot, capabilities) -> ValidationIssues
  publish(snapshot, executionIdentity) -> DeliveryOutcome
  reconcile(executionIdentity, providerReference) -> ReconcileOutcome

ConnectionGateway
  begin(...), discover(...), select(...), refresh(...), revokeWhenSupported(...)

DeliveryOutcome
  published(externalId, externalUrl?, publishedAt)
  processing(deliveryReference, nextCheckAt)
  rejected(code, retryDisposition, retryAfter?)
  unknown(reason, evidenceReference?)

retryDisposition
  safe_to_retry | terminal | reconcile_first
```

`validate` no modifica texto, recorta imágenes ni cambia cuentas. `capabilities` identifica adapter, versión, tipo de cuenta, formatos y restricciones. El manifiesto no reemplaza autorización ni prueba live. Un destino usa una cuenta concreta y una ruta de adapter fija; no cambia de proveedor después de un timeout.

Publicar se invoca una vez por Publication e intento autorizado. Si Social SDK acepta múltiples targets, el wrapper envía uno por llamada para mantener aislamiento y trazabilidad. Implementar o adaptar sus stores durables donde su contrato lo requiera. Repetir la misma clave dentro del SDK no equivale a permitir un nuevo intento: su store debe distinguir un replay de una confirmación de no-escritura que autoriza reintento. Validar ese protocolo en P0.

Las credenciales de aplicación por red (client ID y secreto, claves de X) son configuración de despliegue. En hosted pertenecen a las cuentas de desarrollador de 2post; en self-hosted las aporta el operador (PRD COST-04). Un adapter `live` se construye solo sobre el adapter directo del SDK, y la configuración rechaza cualquier backend gestionado.

## 6. Contratos comunes REST

REST usa `/v1`, JSON y HTTPS. Fechas RFC3339 con offset, almacenadas como instantes UTC. IDs UUID opacos en ejemplos contractuales; no codificar proveedor ni owner dentro del ID. Listas ordenan por `(createdAt DESC, id DESC)` y usan cursor opaco firmado que incluye filtros y entorno. `limit` predeterminado 20, máximo 100.

Los errores usan HTTP y un envelope estable:

```json
{
  "error": {
    "code": "account_selection_required",
    "message": "Hay varias cuentas de X. Indica el accountId.",
    "requestId": "req_01",
    "retryable": false,
    "details": { "network": "x" }
  }
}
```

400 corresponde a JSON inválido; 401 a credencial ausente, revocada o inválida; 403 a scope insuficiente; 404 también oculta recursos de otro workspace; 409 a conflicto de versión, petición idempotente en curso o estado; 422 a contenido o fecha inválidos; 429 a límite con `Retry-After`; 503 a indisponibilidad interna antes de aceptar. Un error posterior a aceptación se consulta en Publication y no convierte retroactivamente el 202 en un fallo HTTP.

Idempotency-Key de 16 a 128 caracteres es obligatorio para publish, schedule, POST /v1/publish, retry y resolve; es opcional en otros POST de negocio, según IDM-01. PATCH usa If-Match. Creación de keys, secretos webhook y connectUrl no guarda respuestas secretas para replay; los callbacks usan nonces propios. El fingerprint incluye actor autorizado, operación, payload normalizado y versión del contrato. El índice de dedupe es `(workspaceId, environment, keyDigest)`, compartido entre REST y MCP. Operación, ruta normalizada y fingerprint se guardan y comparan; usar la misma key para otra operación también es reutilización inválida. Se comprueba autorización vigente antes de devolver un replay. Mismo fingerprint devuelve el mismo recurso y resultado; payload distinto devuelve `idempotency_key_reused` (422). TTL mínimo 7 días después de aceptación. Una Publication conserva su identidad más tiempo y no puede redispararse por caducar el registro HTTP. Una nueva key sí representa una nueva intención; el caller debe conservarla en retries.

### 6.1 Identidad, keys, redes y cuentas

Las rutas y scopes del PRD §8.2 son el catálogo de referencia. Los siguientes detalles completan el contrato:

- `GET /v1/me`: workspace, entorno, keyId, scopes y allowedAccountIds, sin secreto.
- `POST/GET /v1/api-keys` y `DELETE /v1/api-keys/:id`: keys:manage, sin ampliar permisos, entorno ni grants; creación muestra secreto una sola vez y no usa un replay que permita recuperarlo.
- `GET /v1/networks`: capabilities por red y entorno con fuentes, fecha y disponibilidad verificada.
- `GET /v1/accounts`, `GET /v1/accounts/:id`: cuentas visibles, accountType, status y default.
- `POST /v1/accounts/connect`: `{network,accountType?,reconnectAccountId?}`; devuelve ConnectSession y enlace humano. accountType vale personal por defecto; organization devuelve account_type_unavailable en el MVP. `GET /v1/connect-sessions/:id` muestra progreso sin secretos.
- `PATCH /v1/accounts/:id`: `isDefault:true`; reemplaza default anterior de la misma red y entorno en una transacción.
- `DELETE /v1/accounts/:id`: desconecta y devuelve efecto sobre trabajo pendiente sin fingir cancelar un intento reclamado.
- `POST /v1/test/accounts`: solo test; crea cuenta sintética con comportamiento fijo según ENV-03.
- `GET /oauth/:network/callback`: protocolo OAuth, validado por intento y state, separado de la autorización por key.

Una key con allowedAccountIds seleccionados no conecta cuentas nuevas para ampliar su propio acceso. Crear conexiones exige accounts:manage y modo all; en otro caso devuelve insufficient_scope. Elegir defaults tampoco amplía grants. No existe una selección por nombre de usuario como sustituto de accountId.

Las páginas de conexión y retorno no permiten redirects arbitrarios. Elegir entre varias cuentas descubiertas usa exclusivamente IDs guardados en el intento y sesión de navegador válida, nunca ownership declarado por el agente.

### 6.2 Posts y snapshots por destino

Content es `{text:string, media:[{mediaId,altText?}]}`; el array admite cero o una imagen. Las operaciones sobre Post existente no copian cambios a Publications previas.

- `POST /v1/posts`: crea Post con content y overrides opcionales por network.
- `PATCH /v1/posts/:id`: cambia content u overrides con If-Match y aumenta versión, aunque ya haya Publications; devuelve existing_publications_unchanged cuando corresponda.
- `GET /v1/posts`, `GET /v1/posts/:id`: contenido actual, estado derivado y publicationCounts.
- `DELETE /v1/posts/:id`: solo sin Publications, en otro caso post_has_publications.
- `POST /v1/posts/:id/validate`: validación sin efectos que devuelve contenido efectivo, destinos, capacidades, errores y warnings. Para X incluye el costClass estimado (PRD COST-01). Debe volver a validar al aceptar porque las cuentas o límites pueden cambiar.
- `POST /v1/posts/:id/publish`: `{targets,allowRepublish?}`; devuelve 202 con Publications queued.
- `POST /v1/posts/:id/schedule`: `{targets,scheduledAt,allowRepublish?}`; devuelve 202 con Publications scheduled.
- `POST /v1/publish`: conveniencia con content, overrides opcionales, targets y scheduledAt opcional. Crea Post y Publications en una sola transacción.

Cada target lleva accountId o network, exactamente uno, y content opcional. Se elimina la forma networks[] del borrador para tener una sola forma contractual. Resolución por network usa solo la cuenta default explícita, activa y visible para la key. La primera cuenta conectada queda default y se informa en la respuesta; al desconectarla no se promueve otra. Una default inaccesible o inexistente produce account_selection_required con candidatos visibles, aunque haya una única alternativa.

Todos los destinos se validan antes de aceptar. La cuota de red del workspace (PRD COST-03) se reserva en la misma transacción. Un destino inválido revierte el lote. Después de aceptación los resultados son independientes y no existe rollback multired. Precedencia de contenido: target.content, Post.overrides[network], Post.content. Un override reemplaza Content completo, sin mezclar campos. La respuesta identifica cuentas y snapshots resueltos. El texto se conserva sin normalización; escapes de protocolo solo son válidos si preservan el texto visible.

La misma cuenta no puede estar dos veces en un request. Una Publication activa o unknown bloquea otra para la misma pareja Post/cuenta. Volver a una cuenta ya publicada exige allowRepublish:true, una intención nueva y una secuencia nueva. Un retry nunca crea otro destino.

### 6.3 Programación, cancelación y retry

Fecha mínima propuesta: 60 segundos desde aceptación; máxima: 365 días. La respuesta devuelve UTC y valor original. Texto relativo se resuelve en el cliente con zona confirmada. El worker siempre usa hora de DB y no envía antes.

- `POST /v1/publications/:id/cancel`: solo scheduled, queued o retry_scheduled; el claim y cancel compiten atómicamente. Si gana claim, devuelve 409 publication_in_progress. Éxito garantiza que no empezará otro intento de esa Publication.
- `POST /v1/posts/:id/cancel`: intenta todos los destinos y devuelve resultado por Publication; puede haber éxito parcial.
- `PATCH /v1/publications/:id`: reprograma o sustituye Content solo en scheduled, con If-Match; crea snapshot revision nueva y conserva anterior. Si el claim ganó, rechaza.
- `GET /v1/publications` y `GET /v1/publications/:id`: filtros y attempts del PRD; devuelve estado, executionPhase, nextAttemptAt, counts y próxima acción recomendada.
- `POST /v1/publications/:id/retry`: desde failed o missed requiere cuenta activa y publish. Inicia otra submissionGeneration sobre el snapshot vigente, valida y crea sus reservas comerciales, reinicia el presupuesto automático y registra quién autorizó. Los retries automáticos conservan la generación; solo el manual desde unknown reconoce riesgo de duplicado. Desde unknown exige además keys:manage, acknowledgeDuplicateRisk:true y reason: es una nueva generación de envío que puede duplicar. No se expone esta variante en MCP.
- `POST /v1/publications/:id/resolve`: desde unknown, exige publish y keys:manage, outcome y evidencia. published requiere ID, URL o referencia verificable; not_published exige prueba de no escritura. Guarda resolución append-only. No se expone por MCP.

Una respuesta ambigua nunca habilita retry automático. El acknowledgment administrativo no prueba ausencia: registra aceptación consciente del riesgo. La respuesta y eventos de esa generación incluyen duplicateRiskAcknowledged:true. Historial y referencias de generaciones previas se conservan.

Publications tiene nueve estados: scheduled, queued, publishing, retry_scheduled, unknown, published, failed, missed y cancelled. Las transiciones exhaustivas son PRD §9.1. En publishing, executionPhase distingue preparación, dispatch y provider_processing. En esta última fase una referencia durable permite polling de solo lectura. Su vencimiento no dispara otro create.

Ventana de tolerancia (PRD EXE-11). Al reclamar una Publication con scheduledAt y sin attempts despachados, el worker calcula `now() - scheduled_at` con hora de DB. Hasta 15 minutos reclama; al marcar el primer dispatch_started_at fija lateBySeconds y late según el retraso real (> 60 segundos). Un claim obtenido dentro de la ventana conserva autorización hasta el dispatch salvo pérdida de lease, como fija EXE-11 AC2. Por encima de 15 minutos la transiciona a missed en la misma transacción, con evento publication.missed, sin attempt de dispatch ni llamada al proveedor. El scheduler aplica el mismo barrido a filas vencidas que ningún worker reclamó. Las publicaciones inmediatas no tienen ventana: se recuperan según §8.2. Ventana y umbral de late son configuración, no constantes de código, para preparar missedSchedulePolicy.

El agregado Post aplica en orden: sin destinos=draft; alguno queued/publishing/retry_scheduled=publishing; alguno scheduled=scheduled; alguno unknown=unknown; todos published=published; todos cancelled=cancelled; alguno published=partially_published; resto=failed (incluye missed). Exponer needsAttention si hay algún unknown aunque el agregado indique trabajo activo.

### 6.4 Imágenes

`POST /v1/media` admite tres entradas que producen el mismo recurso: cuerpo binario con `Content-Type` image/jpeg, image/png o image/webp; multipart/form-data con un archivo y alt text opcional; o JSON `{sourceUrl, altText?}` en el MVP completo (PRD MED-07). Las dos primeras se reciben por streaming con límite total de 5 MiB. Un Post o target referencia luego el `mediaId`. Tipos globales JPEG, PNG y WebP; cada red puede aceptar un subconjunto más estricto. `GET /v1/media/:id` devuelve metadata visible al tenant sin URL permanente pública.

Preparación única (PRD MED-08): validar magic bytes y límite de píxeles antes de decodificar (protección frente a decompression bombs; propuesta 40 MP), decodificar, aplicar la orientación EXIF a los píxeles, conservar el perfil ICC o convertir a sRGB de forma explícita, eliminar EXIF, GPS, XMP, IPTC y chunks de texto y recodificar en el mismo formato. JPEG y WebP lossy se recodifican con calidad alta fija (propuesta: 92) sin cambiar dimensiones; PNG y WebP lossless, sin pérdida. Propuesta de librería: sharp sobre libvips, fijada en P0. El original se descarta tras procesar y sha256 describe el resultado. Si la imagen preparada supera el límite de una red, se rechaza en validación; no se reduce. No SVG, GIF, video ni varias imágenes. Un timeout antes de devolver el mediaId puede dejar objeto huérfano, que limpia el recolector sin tocar objetos referenciados. Un objeto ready no se reemplaza: nuevos bytes crean otro mediaId.

Importación por URL: la descarga usa el mismo egress protegido de los webhooks (§9). Solo https en el puerto 443, sin credenciales en la URL, DNS resuelto y fijado a una IP pública validada en cada conexión, IPv4 e IPv6, máximo 3 redirects revalidados, timeout total de 10 s, corte a 5 MiB y sin cookies ni cabeceras de autenticación. Se guardan solo host y digest de la URL, nunca la URL completa ni su query. La descarga ocurre una vez; publicar nunca vuelve a la URL. MCP expone la misma operación como import_image.

AltText se conserva por MediaRef con máximo de 1.000 caracteres. Si un adapter no lo soporta, devuelve warning explícito. URLs al proveedor se generan frescas al ejecutar y duran solo el upload. El horizonte de programación no depende de que sobreviva una URL firmada original.

## 7. MCP comparte los mismos casos de uso

La primera entrega es remota sobre `/mcp`, Streamable HTTP y API key configurada en Authorization. Es autenticación estática para clientes que permiten headers personalizados; no se anuncia como flujo OAuth interoperable con todos los conectores alojados. La [especificación de autorización MCP](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) describe un flujo OAuth diferente; adoptarlo y añadir stdio son fases futuras si los clientes objetivo lo necesitan.

Revisión objetivo propuesta: 2026-07-28. La [especificación de transporte](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) cambia detalles respecto a 2025-11-25. P0 debe confirmar soporte del SDK y de un cliente de referencia, fijar versiones y registrar revisiones realmente negociadas. Si el cliente solo admite una revisión anterior, implementarla explícitamente con su SDK y tests propios; no mezclar semánticas. MCP-01 no se considera cumplido hasta este spike.

2post es agnóstico al agente. Muse y Grokbot son agentes personales: sus pruebas de compatibilidad se documentan por separado y no bloquean el MVP (PRD D-17). El contrato se valida primero con el cliente de referencia y después con un cliente MCP remoto conocido. Si un agente solo admite OAuth o stdio, su fila queda bloqueada, sin fingir compatibilidad. clientInfo es autodeclarado y nunca concede permisos. La key identifica workspace, entorno, scopes y cuentas; cada tool revalida acceso aunque apareciera antes en tools/list. Validar Origin cuando está presente y rechazar hosts no permitidos. No poner tokens en URLs ni persistirlos en sesiones MCP.

El catálogo exacto es PRD §10.2: whoami, list_networks, list_accounts, create_connect_link, get_connect_session, create_post, update_post, get_post, list_posts, validate_post, publish_post, schedule_post, publish, cancel_post, cancel_publication, update_scheduled_publication, get_publication, list_publications y retry_publication solo desde failed o missed. upload_image e import_image se añaden al MVP completo: la primera como base64 con límite de 2 MiB decodificados y límite de mensaje derivado; la segunda con sourceUrl por el egress protegido de §6.4. Ambas usan la misma preparación REST. No hay otro fetch de URLs.

publish_post y schedule_post reciben un postId existente y targets; publish crea y envía en una llamada. Esta última exige posts:write además de publish, igual que POST /v1/publish. Las herramientas con efecto público exigen idempotencyKey y la misma operación normalizada que REST. No exponer resolve ni retry de unknown por MCP.

Cada tool tiene JSON Schema para entrada y salida, structuredContent y resumen textual. Errores de negocio llevan isError:true y el mismo envelope de REST; JSON-RPC se reserva a errores de protocolo. Filtrar tools/list por scopes mejora la experiencia, pero no sustituye autorización. Annotations son informativas. Cancelar el request MCP no cancela trabajo ya aceptado: el caller utiliza cancel_post.

El host aplica la política de consentimiento del usuario antes de publicar, mostrando contenido, cuentas y fecha cuando corresponda. 2post registra el actor y su key, sin inventar evidencia de consentimiento conversacional. Los datos de posts y errores son contenido no confiable para el agente.

## 8. Atomicidad y ejecución durable

### 8.1 Aceptación

En una transacción se bloquean Post y registro de idempotencia, se verifican versión y conflictos de destino, se crean snapshots de Publications, sus relaciones de media, eventos y wakes de outbox, y se guarda respuesta. Cualquier fallo hace rollback de todo. Publicar no realiza llamadas sociales dentro de esa transacción.

El dispatcher lee outbox y encola en pg-boss. Si el proceso cae entre enqueue y marcar outbox entregado, puede haber dos jobs; el worker deduplica por estado e identidad durable. El scheduler barre cada 5 segundos las filas elegibles con fecha vencida y publica wakes de reparación cuando falta entrega. Hora de DB es la autoridad y nunca se hace dispatch antes de `scheduledAt`.

pg-boss es mecanismo de entrega, no fuente de verdad del estado público. Se desactiva cualquier retry automático del handler que vuelva a llamar al proveedor sin consultar el protocolo de dominio. Se permite redelivery del job para leer estado, recuperar trabajo preenvío o reconciliar. Una reprogramación incrementa contentVersion y version; jobs viejos vuelven a consultar fecha, estado y versión. El snapshot original vive en publication_revisions y no se sobrescribe después de claim.

### 8.2 Claim y envío

1. Bloquear Publication, comprobar tenant, entorno, fecha, ventana de tolerancia, cuenta activa, cuota, presupuesto de proveedor y estado elegible. Fuera de la ventana, transicionar a missed sin attempt.
2. Crear `PublicationAttempt` y claim con token de ejecución, versión y lease. Commit. Cancelaciones posteriores ven ejecución en curso.
3. Preparar upload y credencial con operaciones seguras. Antes de cualquier creación social, revalidar claim y marcar durablemente `dispatch_started_at` usando compare-and-set. Un intento con marca de dispatch obtiene una única autorización para llamar al proveedor.
4. Hacer la llamada con deadline de 30 segundos y sin retry de mutación en la librería HTTP. Si el lease o validación se pierde antes de dispatch, no llamar.
5. Persistir outcome, referencia, historial y evento en una transacción, verificando token e intento activo. Si el resultado llega tarde, guardar evidencia vinculada al intento y reconciliar en lugar de descartarla o pisar otro resultado.

Un lease vencido sin marca de dispatch permite recuperar preparación. Con marca de dispatch se pasa a resultado incierto. No autoriza otro envío. Un worker pausado que ya obtuvo permiso puede completar su única llamada; ningún sustituto vuelve a publicar. Leases y fencing protegen DB, no cancelan un efecto remoto ya autorizado.

### 8.3 Resultado incierto y procesamiento remoto

Timeout después de enviar, conexión cortada con bytes enviados, caída tras aceptación remota o respuesta imposible de clasificar producen `unknown`. Respuesta `accepted` o `processing` con referencia produce seguimiento de solo lectura, no un nuevo publish. La recepción de un 2xx sin identificador ni prueba suficiente no se trata como éxito definitivo.

Reconciliar significa consultar una referencia estable, idempotency token nativo o clave de registro demostrada. No inferir publicación solo por coincidencia de texto ni ausencia en una búsqueda eventualmente consistente. Si el adapter no puede demostrar publicación o no-escritura, mantener unknown, alertar y pedir revisión. No degradarlo automáticamente a failed para desbloquear retry. Una resolución manual requiere evidencia y se audita. La nueva generación reconocida de PUB-09 es una acción administrativa explícita, no una reconciliación ni garantía de ausencia de duplicados.

El polling de procesos remotos tiene presupuesto separado del envío. Si una referencia sigue en procesamiento más allá del plazo verificado de la red, se informa incertidumbre; no se crea otro post. Ver estado y transiciones normativas en [PRD](PRD.md).

### 8.4 Retry y límites

Los delays propuestos son 5s, 30s, 2m y 10m, con jitter de ±20%. Respetar `Retry-After` cuando sea mayor. Máximo cuatro retries automáticos después del intento inicial. Un 429 o 5xx es seguro solo si el adapter prueba rechazo previo a creación; un 5xx genérico tras dispatch requiere reconciliación. Errores definitivos de contenido o permisos terminan en `failed` con acción indicada, sin reescribir contenido.

El rate limiter evalúa key, workspace, cuenta y credencial del proveedor en servidor. Propuesta inicial: 120 requests/minuto/key, 30 operaciones de publicación/minuto/key y 300/workspace; máximo 10 destinos por request y 1 llamada de creación simultánea por cuenta. Se validan antes del piloto y se configuran sin deploy. El presupuesto de proveedor se reserva de forma transaccional antes de dispatch. Saturación interna conserva el trabajo durable y expone `nextAttemptAt`. Una llamada fallida puede consumir cuota; nunca devolverla por asumir que no fue facturada. En X el presupuesto se mide en coste estimado: cada attempt registra costClass, precio de la tabla vigente y su versión. Alertas y tope duro del presupuesto global (PRD COST-02) se evalúan al reservar; la cuota por workspace (COST-03) se reserva al aceptar y se libera solo si no hubo dispatch.

### 8.5 Acceso comercial, cuotas y prepago

El [plan comercial](COMMERCIAL-PLAN.md) define las tarifas iniciales. Un comando de operador registra pago verificado y activa derechos del workspace, con referencia externa única y auditoría. Ni `keys:manage` ni un cliente MCP permiten esa operación. No se almacenan tarjetas. Sandbox, Builder, Pro y concesiones de piloto son presets versionados de configuración, no un catálogo editable de suscripciones.

Al aceptar un lote se bloquea el derecho del workspace, se valida vigencia y número de cuentas activas, se reserva la cuota no-X del mes UTC de aceptación, la cuota X y el saldo prepago por generación de destino. Todo se confirma junto a Publications, idempotencia y outbox o se revierte. Las conexiones cuentan contra el límite al confirmar la selección OAuth, también bajo lock, no solo al emitir el enlace. Cambiar o bajar plan bloquea nuevas conexiones sobre el límite sin desconectar silenciosamente las existentes.

La cuota incluida pasa de reserva a consumo en el primer dispatch de la Publication; un retry no la consume de nuevo. Un destino no despachado devuelve su unidad al período original. El prepago X mantiene reserva hasta publicación confirmada o fallo definitivo; `unknown` la conserva. Cada generación con riesgo reconocido tiene reserva propia y puede facturarse si se confirma. Una corrección tardía después de una liberación exige ajuste auditado por operador, nunca débito automático que deje saldo negativo. El costo estimado de cada attempt upstream sigue en el presupuesto de proveedor y no equivale al cargo al cliente.

Se congelan clase de precio, versión y tarifa por generación. Una edición scheduled que cambie texto o URL vuelve a validar y ajusta reservas atómicamente con autorización del caller; no altera una reserva ya despachada. El worker comprueba la reserva de trabajos aceptados aunque el período pagado haya vencido. Para nuevas operaciones o nuevos retries manuales requiere derecho vigente. `GET /v1/me` expone límites, consumo, vigencia y saldo sin referencias privadas de cobro. Replays de idempotencia, jobs duplicados y resoluciones no duplican movimientos comerciales.

## 9. Webhooks

REST: crear, listar, consultar, pausar, revocar y rotar secretos bajo `/v1/webhook-endpoints`. El secreto se muestra una vez al crear o rotar. A diferencia de API keys, debe conservarse cifrado porque el servidor lo necesita para firmar. Rotación permite dos versiones durante una ventana de 24 horas y firma con ambas, incluyendo dos valores v1.

Cada cambio público genera un evento inmutable dentro de la misma transacción que el estado. Envelope público conforme WHK-03: id, type, apiVersion=v1, createdAt, workspaceId, environment, actor y data.object con id, version y metadata pública. aggregateId, aggregateVersion y schemaVersion son metadata interna de persistencia, no un envelope alternativo. No incluir tokens, secretos ni texto completo por defecto. `event.id` permanece estable entre reintentos.

Firma `HMAC-SHA256(secret, timestamp + "." + rawBody)` con timestamp epoch en segundos y header `2post-Signature: t=...,v1=...`. Header `2post-Event-Id` permite dedupe. El receptor valida bytes crudos, tolerancia temporal sugerida de 5 minutos y guarda IDs procesados. Reintentos generan timestamp y firma nuevos para el mismo body y eventId.

Entrega at-least-once sin orden global. data.object.version permite detectar atraso. 2xx confirma; cualquier otro status o fallo de red reintenta, con protección de presupuesto por endpoint. Hay ocho intentos, el inicial y siete retrasos de 10s, 1m, 5m, 30m, 2h, 8h y 13h, con jitter, dentro de aproximadamente 24h; luego dead letter. Tres días de fallos continuos deshabilitan el endpoint sin eliminar su historial. Un replay crea otra entrega del mismo evento, no un publish social.

Solo destinos HTTPS, sin credenciales URL, puertos arbitrarios ni IP privada, loopback, link-local o metadata de nube. Validar IPv4 e IPv6 y DNS en registro y cada conexión, fijar IP aprobada, revalidar redirects o deshabilitarlos. Timeout 10s y respuesta máxima 64 KiB. Si no se puede garantizar transporte protegido frente a rebinding, no habilitar destinos externos. Este control aplica también a endpoints federados de Bluesky, descargas de proveedores e importación de media por URL.

## 10. Operación y privacidad

Logs estructurados con requestId, actor y credencial no secreta, workspace, entorno, post, Publication, intento, job, red y adapter. No registrar cuerpos de posts por defecto. Sanitizar errores de terceros antes de persistirlos o exponerlos. Auditoría registra conexión, uso de keys, cambios de estado, cancelación, retry y resolución manual.

Credenciales y sesiones sociales usan cifrado autenticado con keyId y associated data de workspace, entorno y conexión. La clave raíz reside fuera de DB: en hosted, AWS KMS con envelope encryption y claves de datos por revisión. Cifrado no reemplaza separación de roles ni red privada para DB. Solo worker y componente de conexión obtienen descifrado; una consulta de estado no lo necesita.

Las clases de retención de PRD RET-01 separan el ciclo de Posts y Publications del de historial operativo, eventos y logs. Retención propuesta: registros de idempotencia 7 días, uploads incompletos 24h y media no referenciada 7 días, cuerpos y media de posts 90 días después de su último destino terminal, outcomes e historial operativo 180 días, eventos del feed público 30 días y logs técnicos 30 días. Mantener media referenciada por un Post vigente y por cualquier Publication no terminal; los 90 días de retención tras último destino solo aplican cuando ya no hay referencia editable del owner o este autorizó archivar. La limpieza nunca deja un mediaId ready apuntando a bytes inexistentes. Si una Publication sigue `unknown`, no purgar pruebas ni media hasta resolución explícita. El borrado a solicitud del owner (PRD RET-02) es un caso de uso auditado que ejecuta el operador: cancela lo cancelable, espera intentos autorizados, purga texto, media y credenciales, conserva una fila mínima en deletion_requests y se reaplica tras cualquier restore. El founder aceptó estos plazos para el MVP; no constituyen un pronunciamiento sobre obligaciones legales de conservación.

Backups diarios cifrados con KMS y recuperación puntual de PostgreSQL en RDS, retenidos 35 días (propuesta), propuesta RPO 15 minutos y RTO 4 horas. Probar restore con workers deshabilitados. Tras restaurar, todos los intentos con dispatch potencialmente posterior al recovery point se reconcilian antes de permitir creación social. Un backup antiguo no es permiso para repetir publicaciones. Después se aplica la ventana de tolerancia a las programadas que vencieron durante la caída.

## 11. Validación y objetivos operativos

Los objetivos del [PRD](PRD.md) son internos y pendientes de medición, no un SLA de venta. Para MET-01/02, una Publication entra una sola vez en la cohorte al fijar firstOutcomeAt por primera llegada a published, failed, missed o unknown; la evaluación usa su estado más reciente al corte. Reportar también tamaño y porcentaje de ventana observada. Una resolución posterior puede corregir el resultado de esa cohorte sin crear un segundo éxito. Medir por Publication y entorno, con histogramas separados de espera interna, proveedor, media, procesamiento remoto y webhook.

Pruebas obligatorias: dos tenants y dos entornos; API key revocada y scope insuficiente; callbacks repetidos; token refresh concurrente; mismo idempotencyKey con payload igual y distinto; rollback del lote inválido; fallo parcial multired; job duplicado; caída en cada frontera de dispatch; resultado incierto; polling sin republicación; cancel contra claim; scheduler sin anticipación; límites y DST; SSRF de webhooks y OAuth federado; media ajena; redacción de secretos; restore sin resend ciego; REST y MCP equivalentes; ventana de tolerancia a 14 y 16 minutos, late y missed tras caída y tras restore; EXIF, GPS, orientación e ICC; importación por URL contra IP privada, redirects y rebinding; misma cuenta externa en dos workspaces con rotación de token cruzada; cuota y tope de X; facets de Bluesky con offsets UTF-8 y emojis; activación comercial idempotente, concurrencia de cuentas y cuotas, saldo insuficiente y unknown con fondos retenidos.

La prueba de carga inicial fija 20 workspaces, 500 cuentas mock diferentes, 20 requests/segundo durante 10 minutos y un burst de 500 Publications venciendo en el mismo segundo. Medir además la variante con muchas Publications de la misma cuenta: su serialización y cuota explican el retraso y no permiten prometer 30s bajo carga ilimitada. Documentar hardware, configuración y distribución. Medir p95 de API sin proveedor, aceptación a resultado y retraso del scheduler. No usar mocks para afirmar latencia real de redes. Ajustar capacidad y cuotas antes de publicar una promesa comercial.

## 12. Base para plataforma de pago y asistencia IA

La UI futura autentica usuarios y llama los mismos casos de uso. El MVP ya tiene derechos comerciales, cuotas y prepago con registro manual de pagos. Una futura integración de checkout y suscripciones automatiza esa entrada mediante referencias idempotentes sin reemplazar el ledger ni la ejecución social. No se crean tablas de modelos IA.

La futura asistencia IA produce una nueva revisión de contenido y exige elección del usuario antes de crear snapshots. Proveedor y modelo son configuración de esa función futura, independientes de `SocialGateway`. No se transforma una suscripción de ChatGPT o Claude en acceso API implícito. Costos, claves propias, retención de prompts y consentimiento se resolverán en un PRD de esa fase.
