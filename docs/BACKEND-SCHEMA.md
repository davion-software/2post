# 2post: esquema del backend

Versión: 0.3. Fecha: 2026-10-21. Estado: diseño propuesto para PostgreSQL, no migraciones ejecutadas.

Derivado del [PRD](PRD.md) y los contratos del [TRD](TRD.md). El [plan](IMPLEMENTATION-PLAN.md) ordena sus migraciones. Los nombres SQL son normativos para el diseño inicial; el ORM y la versión exacta se fijan al implementar.

## 1. Convenciones y aislamiento

- PK `id uuid` generada antes de aceptar una operación. La API puede representar el UUID con prefijo tipado opaco, como post_, según PRD §8.1; los prefijos no son una parte del modelo relacional.
- Instantes `timestamptz` y reloj de PostgreSQL. `time_zone text` conserva zona IANA para presentación, no sustituye al instante.
- `environment text CHECK (environment IN ('test','live'))` en toda fila del workspace cuyo acceso depende de una key o un job.
- Toda tabla de negocio lleva `workspace_id uuid NOT NULL`; no se infiere el tenant solamente siguiendo un postId.
- Cada padre de negocio tiene `UNIQUE (workspace_id, environment, id)`. Sus hijos lo referencian con FK compuesta. Un UUID válido de otro workspace debe fallar incluso si la capa de aplicación omite una validación de pertenencia.
- `created_at NOT NULL DEFAULT now()` y, en filas mutables, `updated_at NOT NULL DEFAULT now()` actualizado por repositorio. `version bigint NOT NULL DEFAULT 1 CHECK(version > 0)` en agregados mutables.
- `?` en las listas de campos significa nullable; el resto es obligatorio. `jsonb` contiene payloads versionados validados, nunca reemplaza una FK crítica.
- Estados como `text + CHECK` permiten migraciones aditivas controladas. No existe columna de estado editable en `posts`: su estado se deriva de Publications.
- Borrado físico `RESTRICT` para históricos. Se permite borrar drafts sin destinos. Archivar cuentas y endpoints conserva referencias. Las excepciones a retención son procesos explícitos auditados.

El aislamiento inicial combina ActorContext verificado, repositorios que exigen workspace y entorno, FK compuestas y pruebas con dos tenants. RLS puede añadirse como defensa adicional; no se presume habilitada. Roles de DB separados para migraciones, API y worker. Las claves de cifrado no se almacenan en estas tablas.

Un workspace es global para identidad y propiedad. Sus recursos test y live son distintos, incluidas cuentas y media. Backups y secretos de staging y producción se separan también físicamente.

## 2. Relaciones principales

Un User posee Workspaces. Un Workspace contiene API keys, conexiones, cuentas, media y Posts. Una conexión autoriza una o varias cuentas del mismo workspace y entorno. Un Post admite varios destinos, y cada Publication apunta a una cuenta concreta. Cada Publication conserva varios PublicationAttempts, pero un retry no crea otra Publication.

La relación entre Post y media es editable mientras es draft. La relación entre Publication y media queda fijada por revisión. Solo una edición scheduled anterior al claim crea otra revisión; nunca modifica bytes o referencias de un intento empezado. Un evento corresponde a una transición y puede tener varias entregas webhook. La cola de jobs nunca es la fuente de verdad de esas relaciones.

## 3. Identidad, workspace y acceso

### 3.1 `users`

Campos: id, email text, status text, created_at y updated_at. Email normalizado y único; estados active|disabled. El bootstrap del operador crea la identidad del owner, no existe registro público ni login humano en el MVP. No almacenar passwords o inventar tokens de login. En la futura plataforma self-serve podrá añadirse una identidad externa verificada sin cambiar los IDs de dominio.

### 3.2 `workspaces`

Campos: `id`, `name text`, `owner_user_id uuid`, `status text`, `created_at`, `updated_at`, `version`.

FK owner a `users(id) ON DELETE RESTRICT`. Estado `active|suspended|archived`. Un owner por workspace. Los planes son presets versionados y sus derechos se guardan en workspace_entitlements. No se crean todavía catálogo de planes, subscriptions, equipos ni roles configurables. Un futuro cambio de owner es transaccional y auditado.

### 3.3 `connect_browser_sessions`

Campos: id, workspace_id, environment, connection_attempt_id uuid, session_digest bytea, csrf_digest bytea, expires_at timestamptz, consumed_at timestamptz?, created_at.

FK compuesta a connection_attempts, UNIQUE(session_digest). Tabla de sesión corta para terminar la conexión iniciada por un connectUrl, no login de usuario ni acceso administrativo. Se crea al consumir el enlace por confirmación POST, se liga al intento, expira a los 15 minutos y se guarda solo el digest del identificador. Cookie Secure, HttpOnly y SameSite compatible con callbacks, con CSRF para elegir o confirmar cuenta. Se crea después de connection_attempts en el orden de migración.

### 3.4 `api_keys`

Campos: `id`, `workspace_id`, `environment`, `created_by_user_id uuid`, `name text`, `lookup_prefix text`, `last_four text`, `key_digest bytea`, `pepper_key_id text`, `scopes text[]`, `expires_at timestamptz?`, `revoked_at timestamptz?`, `last_used_at timestamptz?`, `created_at`.

FK workspace a `workspaces`, creador a `users`. `UNIQUE(key_digest)`. Verificar scopes contra la lista del TRD y prohibir arrays vacíos. El prefijo visible identifica la key, no permite autenticarla. La respuesta de list nunca devuelve digest, pepper ni secreto completo. La emisión guarda issued_by_api_key_id nullable con FK compuesta para keys hijas; bootstrap usa null y created_by_user_id del owner. La hija solo reduce scopes, duración y cuentas respecto a la emisora. La revocación de la última key keys:manage se valida bajo lock de workspace y entorno.

### 3.5 `api_key_accounts`

Campos: `workspace_id`, `environment`, `api_key_id uuid`, `social_account_id uuid`, `created_at`.

PK `(api_key_id,social_account_id)` y FK compuestas a key y cuenta. Añadir `account_access_mode text CHECK IN ('all','selected')` a `api_keys`: `all` permite las cuentas del workspace; `selected` solo las relacionadas, y cero relaciones significa ninguna cuenta. No usar ausencia de filas para representar simultáneamente acceso total y denegación.

## 4. Conexiones y cuentas sociales

### 4.1 `social_connections`

Campos: `id`, `workspace_id`, `environment`, `network text`, `adapter_key text`, `adapter_version text`, `provider_connection_id text?`, `status text`, `credential_ciphertext bytea?`, `credential_key_id text?`, `credential_revision bigint`, `credential_expires_at timestamptz?`, `granted_scopes text[]`, `refresh_claim_token uuid?`, `refresh_claim_expires_at timestamptz?`, `connected_by_api_key_id uuid`, `disconnected_at timestamptz?`, `created_at`, `updated_at`, `version`.

Estados `active|reconnect_required|disconnected|revoked`. `CHECK(credential_revision >= 0)`. Cifrado autenticado de payload con access/refresh tokens, sesión y claves propias del protocolo. Associated data incluye workspace, entorno, conexión y revisión. No hay columna de token en texto plano.

Una conexión active de live debe tener ciphertext y keyId. Una conexión mock de test no contiene credenciales reales ni necesita ciphertext; su adapter está fijado a SimulatedGateway. Rotación compara `credential_revision` y tiene exclusión compartida antes de usar un token rotatorio. Revocar no borra otras conexiones del mismo usuario ni otras cuentas seleccionadas de una conexión todavía en uso. Conexiones de la misma identidad externa en workspaces distintos son filas y ciphertexts distintos; nunca se copia ni referencia una credencial de otro workspace. Antes de una revocación upstream, una consulta interna de sistema puede comprobar si existe otra conexión activa de la misma app e identidad, sin exponer el resultado.

### 4.2 `connection_attempts`

Campos: `id`, `workspace_id`, `environment`, `initiated_by_api_key_id uuid`, `connect_token_digest bytea`, `connect_token_consumed_at timestamptz?`, `network text`, `adapter_key text`, `state_digest bytea`, `private_state_ciphertext bytea`, `private_state_key_id text`, `callback_uri text`, `return_uri text`, `status text`, `expires_at timestamptz`, `exchange_claimed_at timestamptz?`, `discovery_completed_at timestamptz?`, `consumed_at timestamptz?`, `error_code text?`, `created_at`, `updated_at`.

Estados `pending|exchanging|discovered|consumed|expired|failed|reconnect_required`. `UNIQUE(state_digest)`, UNIQUE(connect_token_digest) e índice sobre expiración para limpieza. State de un solo uso, principal, destino y PKCE o DPoP cifrados. Una marca de intercambio no caduca para autorizar repetición de un código OAuth; una caída sin credenciales guardadas requiere nueva conexión.

### 4.3 `discovered_accounts`

Campos: `id`, `workspace_id`, `environment`, `connection_attempt_id uuid`, `external_account_id text`, `account_type text`, `username text?`, `display_name text?`, `provider_reference jsonb`, `provisional_credentials_ciphertext bytea?`, `credential_key_id text?`, `selected_at timestamptz?`, `created_at`.

FK compuesta a intento; `UNIQUE(connection_attempt_id,external_account_id)`. Son resultados de descubrimiento verificado, no cuentas de negocio usables. La selección consume intento y crea conexión, grants y cuentas de forma atómica. Los secretos provisionales expiran con el intento y no salen al navegador.

### 4.4 `social_accounts`

Campos: `id`, `workspace_id`, `environment`, `connection_id uuid`, `network text`, `external_account_id text`, `account_type text`, `username text?`, `display_name text?`, `provider_account_id text?`, `status text`, `is_default boolean DEFAULT false`, `capability_manifest jsonb`, `capability_checked_at timestamptz?`, `disconnected_at timestamptz?`, `created_at`, `updated_at`, `version`.

FK compuesta a conexión y `UNIQUE(workspace_id,environment,network,external_account_id)`. Estados `active|reconnect_required|disconnected`. Un evento de revocación upstream produce reconnect_required hasta desconexión explícita. Reconectar la misma identidad externa conserva ID. Índice UNIQUE(workspace_id,environment,network) WHERE is_default asegura una default por red. La primera cuenta conectada se marca default bajo lock, las siguientes no la reemplazan; desconexión la borra sin promover otra. Username es mutable y nunca se usa para demostrar ownership. `account_type` lleva `CHECK (account_type IN ('personal','organization'))` desde la primera migración; el MVP solo crea personal, y organization se habilita con PRD ACC-11. La misma identidad externa puede repetirse en otro workspace: la unicidad es por workspace, entorno, red e identidad externa, y ninguna consulta de negocio busca la cuenta fuera de su tenant.

Para evitar inconsistencias red/conexión, declarar también `UNIQUE(workspace_id,environment,id,network)` en conexiones y referenciar `(workspace_id,environment,connection_id,network)`. Test solo puede tener conexiones mock. La regla se valida al escribir y al resolver el adapter; el DB role de test no lee credenciales de producción.

## 5. Media y contenido

### 5.1 `media_assets`

Campos: `id`, `workspace_id`, `environment`, `created_by_credential_id uuid?`, `source text`, `source_host text?`, `source_url_digest bytea?`, `object_key text`, `object_version text?`, `status text`, `type text`, `declared_mime_type text`, `verified_mime_type text?`, `declared_size_bytes bigint`, `verified_size_bytes bigint?`, `sha256 bytea?`, `width integer?`, `height integer?`, `metadata_stripped_at timestamptz?`, `color_profile text?`, `upload_expires_at timestamptz?`, `ready_at timestamptz?`, `purge_after timestamptz?`, `error_code text?`, `created_at`, `updated_at`.

Estados `uploading|validating|ready|rejected|deleted`. MVP `type='image'`. Tamaños positivos y máximos según contrato. `UNIQUE(object_key,object_version)` cuando hay versión. `ready` exige MIME validado JPEG, PNG o WebP, hash de 32 bytes, tamaño, dimensiones, versión inmutable de objeto y metadata_stripped_at no nulo. source ∈ upload|url; para url se guardan solo host y digest, nunca la URL completa. sha256 describe los bytes preparados; el original no se almacena. No almacenar signed URLs expirables como ubicación canónica. La API acepta binario, multipart y, en el MVP completo, importación por URL: uploading y validating describen la descarga y preparación interna durante esa petición, no endpoints de signed upload. Recuperación limpia objetos huérfanos después de fallos.

### 5.2 `posts`

Campos: `id`, `workspace_id`, `environment`, `created_by_credential_id uuid?`, `created_by_user_id uuid?`, `content_text text`, `submitted_at timestamptz?`, `archived_at timestamptz?`, `created_at`, `updated_at`, `version`.

Contenido vacío es válido solo si existe media válida. La comprobación de texto o media cruza tablas: se valida dentro de la transacción de draft y de aceptación, con trigger diferido si se requiere invariancia contra escrituras directas. No declarar que un CHECK de una sola fila protege relaciones externas.

Ausencia de Publications define status draft. Post es editable con control de versión en cualquier momento; submitted_at registra solo la primera aceptación. Ninguna edición cambia snapshots de Publications ya creadas. Mantener historial de revisión por destino permite auditar cuál se ejecutó.

### 5.3 `post_media`

Campos: `workspace_id`, `environment`, `post_id uuid`, `media_id uuid`, `position smallint`, `alt_text text?`.

PK `(post_id,position)`, `UNIQUE(post_id,media_id)`, FK compuestas a Post y media. `CHECK(position >= 0)`. MVP admite como máximo una imagen por contenido efectivo, pero el orden evita una migración de forma al ampliar el límite. Las filas cambian con PATCH del Post en transacción y control de versión; no cambian publication_media.

### 5.4 `post_overrides` y `post_override_media`

post_overrides contiene workspace_id, environment, post_id, network, content_text y version. PK(post_id,network), FK compuesta a Post. post_override_media contiene workspace_id, environment, post_id, network, media_id, position y alt_text, con FK a la variante y al asset del mismo tenant. PK(post_id,network,position).

Un override es un Content completo: ausencia de filas de media significa sin imagen, no herencia. Al cambiar overrides se actualizan estas relaciones en la misma transacción que Post.version. Eliminar un override permite volver a heredar el Content raíz en nuevos destinos, sin tocar destinos previos.

## 6. Publications e intentos

### 6.1 `publications`

Campos de identidad y snapshot:

- `id`, `workspace_id`, `environment`, `post_id uuid`, `social_account_id uuid`, `network text`, `destination_sequence integer`, `submission_generation integer DEFAULT 1`.
- `adapter_key text`, `adapter_version text`, `account_external_id_snapshot text`.
- `effective_text text`, `content_hash bytea`, `post_version bigint`, `content_version integer`, `snapshot_version smallint`.
- `accepted_at timestamptz`, `scheduled_at timestamptz?`, `time_zone text?`.

Campos de ejecución:

- `status text`, `execution_phase text?`, `duplicate_risk_acknowledged boolean DEFAULT false`, `available_at timestamptz`, `active_attempt_id uuid?`, `attempt_count integer DEFAULT 0`, `automatic_retry_count integer DEFAULT 0`.
- `execution_token uuid?`, `execution_lease_expires_at timestamptz?`, `dispatch_started_at timestamptz?`, `next_reconcile_at timestamptz?`.
- `external_id text?`, `external_url text?`, `confirmation_evidence jsonb?`, `provider_delivery_reference jsonb?`, `published_at timestamptz?`.
- `last_error_code text?`, `last_error_message text?`, `last_error_attribution text?`, `last_error_retryable boolean?`, `retry_disposition text?`, `late boolean DEFAULT false`, `late_by_seconds integer?`, `missed_at timestamptz?`, `cancelled_at timestamptz?`, `first_outcome_at timestamptz?`, `resolved_at timestamptz?`, `created_at`, `updated_at`, `version`.

FK compuestas a Post y cuenta. UNIQUE(post_id,social_account_id,destination_sequence) distingue intenciones explícitas. Índice UNIQUE(post_id,social_account_id) WHERE status IN (scheduled,queued,publishing,retry_scheduled,unknown) impide destinos activos duplicados. La secuencia se reserva bajo lock del Post; si ya hay published, solo allowRepublish:true crea otra. No deducir secuencia usando MAX sin bloqueo. `content_hash` es SHA-256 del snapshot canónico, incluidas referencias inmutables y alt text. No deduplicar publicaciones por hash entre Posts distintos: contenido idéntico puede ser intención legítima.

Estados: scheduled|queued|publishing|retry_scheduled|unknown|published|failed|missed|cancelled. El agregado se gobierna en PRD §9.3. La DB impide published sin published_at y sin al menos external_id, external_url o confirmation_evidence verificable; cancelled exige cancelled_at; missed exige missed_at y dispatch_started_at nulo. late_by_seconds se fija con el primer dispatch de una Publication programada y no cambia en retries. En publishing, execution_phase es preparing|dispatching|provider_processing. Una referencia de processing permite polling, nunca otro create. `scheduled_at` puede ser null para envío inmediato; `available_at` siempre existe. No comparar `now()` dentro de un CHECK para decidir si el scheduler puede ejecutar: esa condición cambia con el tiempo y se comprueba al reclamar.

FK de cuenta incluye network con un índice único equivalente en `social_accounts`. `active_attempt_id` requiere FK diferida `(workspace_id,environment,id,active_attempt_id)` hacia la pareja `(workspace_id,environment,publication_id,id)` de intentos, evitando apuntar al intento de otra Publication. Se añade después de crear ambas tablas, con UNIQUE(workspace_id,environment,publication_id,id) explícito en publication_attempts como destino de esa FK.

Índices operativos:

- `(workspace_id,environment,created_at DESC,id DESC)` para listados.
- `(workspace_id,environment,status,created_at DESC,id DESC)` para filtros.
- `(available_at,id)` parcial sobre estados que aceptan claim.
- `(next_reconcile_at,id)` parcial sobre resultados que requieren polling o reconciliación.
- `(execution_lease_expires_at,id)` parcial para recuperación de claims.
- `UNIQUE(workspace_id,environment,social_account_id,external_id) WHERE external_id IS NOT NULL` para detectar evidencia duplicada sin confundir dos cuentas.

### 6.2 `publication_media`

Campos: `workspace_id`, `environment`, `publication_id uuid`, `content_version integer`, `media_id uuid`, `position smallint`, `object_version_snapshot text`, `sha256_snapshot bytea`, `alt_text_snapshot text?`.

PK (publication_id,content_version,position), FK compuesta a publication_revisions y a media. No referenciar solo la versión actual de Publication. Se insertan una sola vez por content_version; son inmutables. Fijan la versión exacta de bytes que se publicará y mantienen el objeto retenido. Un override con `media: []` no crea filas y no hereda después otra imagen por accidente.

### 6.3 `publication_revisions`

Campos: workspace_id, environment, publication_id uuid, content_version integer, content_text text, content_hash bytea, scheduled_at timestamptz?, post_version bigint, changed_by_credential_id uuid, created_at.

PK(publication_id,content_version), FK compuesta a Publication. Snapshot inicial en versión 1. Solo PATCH scheduled crea otra revisión; incrementa content_version y Publication.version de forma atómica. Los intentos apuntan a una revisión concreta. Un trigger prohíbe editar o borrar una revisión utilizada por un intento o por un evento retenido. La primera revisión también registra el origen del contenido: target, override por network o raíz.

### 6.4 `publication_attempts`

Campos: `id`, `workspace_id`, `environment`, `publication_id uuid`, `social_account_id uuid`, `content_version integer`, `submission_generation integer`, `attempt_number integer`, `kind text`, `execution_token uuid`, `payload_hash bytea`, `provider_idempotency_key text?`, `claim_created_at timestamptz`, `lease_expires_at timestamptz`, `dispatch_started_at timestamptz?`, `response_received_at timestamptz?`, `finished_at timestamptz?`, `phase text`, `outcome text?`, `provider_request_id text?`, `provider_reference jsonb?`, `http_status integer?`, `error_code text?`, `error_message text?`, `error_attribution text?`, `error_retryable boolean?`, `provider_error_code text?`, `retry_disposition text?`, `evidence jsonb?`, `cost_class text?`, `estimated_cost_micros bigint?`, `price_table_version text?`, `created_at`, `updated_at`.

FK compuesta a Publication. `UNIQUE(publication_id,attempt_number)`, `UNIQUE(execution_token)`, `CHECK(attempt_number > 0)`. Tipos `initial|automatic_retry|manual_retry`. Phase preparing|dispatching|provider_processing|completed. Outcome null mientras corre; terminal succeeded|failed|unknown|abandoned. Un intento terminal es inmutable. La reconciliación añade publication_resolutions y cambia Publication, conservando el outcome histórico unknown. FK a publication_revisions fija bytes y contenido de ese intento.

Índice único parcial por publication_id WHERE outcome IS NULL impide dos intentos activos, incluido provider_processing. Desde unknown no se habilita retry automático. PUB-09 permite una nueva submission_generation solo con acknowledgeDuplicateRisk:true, publish, keys:manage y razón auditada. La resolución publicada o no publicada también requiere evidencia. Añadir también UNIQUE(social_account_id) WHERE outcome IS NULL para garantizar un solo intento en curso por cuenta, y FK compuesta que obliga a que publication_id y social_account_id correspondan al mismo destino, respaldada por UNIQUE(workspace_id,environment,id,social_account_id) en publications. El índice no reemplaza las reglas de transición ni autoriza retry externo.

`dispatch_started_at` se escribe antes de la llamada remota. No se cambia de null a valor más de una vez por intento. Si se pierde el proceso después, no se interpreta su lease vencido como no-escritura. Un resultado tardío conserva token e intento para reconciliar.

### 6.5 `publication_resolutions`

Campos: id, workspace_id, environment, publication_id uuid, attempt_id uuid, source text, outcome text, evidence jsonb, resolved_by_credential_id uuid?, reason text, created_at.

FK compuestas a Publication y a su intento. Source reconciliation|manual; outcome published|not_published. Append-only. Evidencia incluye ID o URL remota estable, referencia de correlación o prueba de no escritura verificada. Una coincidencia de texto solo es candidato. El caso de uso actualiza Publication junto con esta fila y el evento; no modifica el intento terminal. Un riesgo reconocido antes de otro envío se guarda en auditoría con submission_generation nueva.

### 6.6 `sdk_idempotency_claims`

Campos: `id`, `workspace_id`, `environment`, `publication_id uuid`, `intent_key text`, `payload_hash bytea`, `status text`, `claimed_at timestamptz`, `saved_outcome jsonb?`, `saved_at timestamptz?`, `version`.

`UNIQUE(workspace_id,environment,intent_key)`. Esta tabla solo se crea si `@opencoredev/social-sdk` exige su store durable con adapters directos. No es el registro HTTP de idempotencia ni una segunda autoridad de Publication. El adapter mapea explícitamente claims, outcome y autorización de retry al contrato probado de esa versión. Estado tentativo `claimed|resolved|unknown`; si el contrato real difiere, corregir el diseño en P0 antes de migrar.

## 7. Idempotencia y eventos

### 7.1 `idempotency_records`

Campos: `id`, `workspace_id`, `environment`, `operation text`, `key_digest bytea`, `request_fingerprint bytea`, `principal_reference text`, `status text`, `http_status smallint?`, `resource_id uuid?`, `response_json jsonb?`, `expires_at timestamptz`, `created_at`, `updated_at`.

`UNIQUE(workspace_id,environment,key_digest)`. La operación forma parte del fingerprint comparado, por lo que la misma key en otro endpoint devuelve idempotency_key_reused. Estados `in_progress|completed`. El registro se crea y completa con la transacción de negocio. No hay una fila `in_progress` comprometida de forma independiente que pueda bloquear para siempre una operación sin recurso. Competidores esperan el lock un plazo acotado y obtienen replay o idempotency_request_in_progress.

No almacenar API key ni el header original; hash del idempotency key es suficiente. El replay se filtra de nuevo por autorización vigente. Respuestas que muestran secretos una sola vez no se guardan aquí: usan protocolo específico de control. Expirar la fila no borra el Post ni permite redisparar una Publication.

### 7.2 `domain_events`

Campos: `id`, `workspace_id`, `environment`, `aggregate_type text`, `aggregate_id uuid`, `aggregate_version bigint`, `event_type text`, `schema_version smallint`, `actor jsonb`, `payload jsonb`, `body_bytes bytea`, `occurred_at timestamptz`.

`UNIQUE(workspace_id,environment,aggregate_type,aggregate_id,aggregate_version,event_type)` y `CHECK(aggregate_version > 0)`. Payload público mínimo versionado; no secretos ni cuerpo de contenido por defecto. actor conserva apiKeyId, canal rest|mcp y clientInfo selfReported cuando aplica, o referencia a connect_session, system u operator. body_bytes conserva la serialización exacta del envelope WHK-03 para firma estable. Append-only. Evento y transición se guardan juntos. Eventos test no se mezclan con métricas ni webhooks live.

### 7.3 `outbox_messages`

Campos: `id`, `workspace_id`, `environment`, `kind text`, `dedupe_key text`, `reference_id uuid`, `payload jsonb`, `available_at timestamptz`, `claimed_by uuid?`, `claim_expires_at timestamptz?`, `dispatched_at timestamptz?`, `dispatch_attempt_count integer DEFAULT 0`, `last_error_code text?`, `created_at`, `updated_at`.

`UNIQUE(workspace_id,environment,dedupe_key)`. Tipos `publication_wakeup|webhook_fanout|reconciliation_wakeup`. Índice parcial `(available_at,id) WHERE dispatched_at IS NULL`. Payload solo IDs, tenant y versión, no bytes ni tokens. `reference_id` es polimórfico por tipo; cada writer valida su FK lógica y un test detecta referencias huérfanas. Si se necesita FK física, separar los tipos en columnas exclusivas con CHECK en la primera migración.

Un crash después de enqueue puede duplicar entrega, nunca la identidad de negocio. Jobs pg-boss viven en el schema administrado por la librería; no crear ni editar manualmente sus tablas internas. No envolver una llamada de red en una transacción de outbox.

## 8. Webhooks y auditoría

### 8.1 `webhook_endpoints`

Campos: `id`, `workspace_id`, `environment`, `url text`, `status text`, `event_types text[]`, `secret_ciphertext bytea`, `secret_key_id text`, `secret_version integer`, `previous_secret_ciphertext bytea?`, `previous_secret_version integer?`, `previous_valid_until timestamptz?`, `consecutive_failures integer DEFAULT 0`, `created_at`, `updated_at`, `version`.

Estados `active|paused|disabled`. Ciphertext, no hash, porque firma. URL validada contra SSRF por transporte además de esquema. Restricciones de URL en CHECK no prueban que DNS sea público. Rotación puede conservar una versión anterior durante 24h. Guardar URL estable por entrega para que un cambio de endpoint no redirija eventos antiguos inadvertidamente.

### 8.2 `webhook_deliveries`

Campos: `id`, `workspace_id`, `environment`, `event_id uuid`, `endpoint_id uuid`, `endpoint_version bigint`, `url_snapshot text`, `replay_number integer DEFAULT 0`, `status text`, `attempt_count integer DEFAULT 0`, `next_attempt_at timestamptz`, `delivered_at timestamptz?`, `last_http_status smallint?`, `last_error_code text?`, `created_at`, `updated_at`.

FK compuestas a evento y endpoint. `UNIQUE(event_id,endpoint_id,replay_number)`; estados `pending|delivering|retry_wait|delivered|failed|cancelled`. El replay conserva eventId y aumenta replayNumber. El worker comprueba que el endpoint sigue autorizado, y cancela pendientes al revocarlo. Entrega de webhook no actualiza el estado social de Publication.

Índice parcial `(next_attempt_at,id)` para pendientes y retry. La firma usa bytes del evento inmutable, no la serialización aleatoria de un objeto reconstruido. Se fija serialización canónica o se guarda `body_bytes bytea` en el evento desde su creación para todas las entregas.

### 8.3 `webhook_delivery_attempts`

Campos: `id`, `workspace_id`, `environment`, `delivery_id uuid`, `attempt_number integer`, `started_at timestamptz`, `finished_at timestamptz?`, `signing_secret_version integer`, `http_status smallint?`, `error_code text?`, `response_excerpt text?`.

FK compuesta a entrega; `UNIQUE(delivery_id,attempt_number)`. Excerpt sanitizado y truncado a 1 KiB, nunca headers de autenticación. Una pérdida de respuesta puede entregar otra vez el mismo evento: el receptor deduplica eventId.

### 8.4 `audit_events`

Campos: `id`, `workspace_id`, `environment`, `actor_type text`, `actor_reference text`, `action text`, `resource_type text`, `resource_id uuid?`, `request_id text`, `reason_code text?`, `evidence jsonb?`, `occurred_at timestamptz`.

Append-only con índices `(workspace_id,environment,occurred_at DESC,id DESC)` y por recurso. Referencia de actor histórica permanece aunque se revoque la key. Evidencia de resolución incierta identifica intento, operador y prueba verificable, sin tokens ni payload upstream sin sanitizar. Acceso reservado al owner y operación autorizada.

### 8.5 `rate_limit_buckets`

Campos: `bucket_key text`, `window_start timestamptz`, `limit_count integer`, `used_count integer`, `expires_at timestamptz`.

PK `(bucket_key,window_start)`, `CHECK(used_count >= 0 AND limit_count > 0)`. Clave codifica tipo de límite y contexto autorizado; no contiene secretos. Se reserva capacidad con update condicional atómico. Un límite global de credencial upstream puede cubrir varios workspaces, pero su consulta nunca revela sus identidades al consumidor. Esta tabla es estado técnico compartido, no recurso consultable por API.

### 8.6 `provider_budgets`

Campos: `id`, `provider_app_key text`, `network text`, `period_start date`, `period_end date`, `budget_micros bigint`, `funded_balance_micros bigint`, `balance_verified_at timestamptz`, `reserved_micros bigint`, `consumed_micros bigint`, `alert_thresholds smallint[]`, `hard_cap boolean`, `price_table_version text`, `updated_at`, `version`.

Estado técnico de la app de proveedor, no recurso de workspace. `UNIQUE(provider_app_key,period_start)` y CHECK de valores no negativos. La reserva se hace con update condicional antes de dispatch contra el menor de presupuesto restante y saldo financiado, descontando reservas; el consumo estimado se confirma con el outcome. funded_balance_micros es una proyección conservadora del saldo de consola conciliado y se reduce por consumo confirmado; una conciliación no vuelve a descontar lo ya registrado. Una llamada fallida no libera lo reservado si pudo facturarse. En self-hosted la app es del operador.

### 8.7 `workspace_network_quotas`

Campos: `workspace_id`, `environment`, `network`, `period_start date`, `limit_count integer`, `reserved_count integer`, `consumed_count integer`, `updated_at`, `version`.

PK `(workspace_id,environment,network,period_start)` y FK al workspace. En live se usa network=x para el límite de seguridad de X y network=non_x para la cuota compartida de LinkedIn y Bluesky. non_x es una categoría de cuota, nunca un valor permitido en social_accounts.network o publications.network. La aceptación reserva en la misma transacción que crea Publications; cancelled, missed o failed sin dispatch liberan la reserva, y un dispatch la convierte en consumo.

### 8.8 `deletion_requests`

Campos: `id`, `workspace_id uuid`, `scope text`, `resource_type text?`, `resource_id uuid?`, `requested_by text`, `reason text?`, `status text`, `requested_at timestamptz`, `completed_at timestamptz?`, `summary jsonb`.

Estados `pending|waiting_outcome|completed|failed`. Registro mínimo sin contenido, sin FK al workspace para sobrevivir a su borrado. Permite reaplicar los borrados tras un restore antes de habilitar workers. summary cuenta los recursos borrados y avisa de las publicaciones externas que no se borran.

### 8.9 `workspace_entitlements`

Campos: `workspace_id`, `environment`, `plan_key text`, `plan_version text`, `status text`, `valid_from timestamptz`, `valid_until timestamptz?`, `active_account_limit integer`, `non_x_monthly_limit integer`, `x_enabled boolean`, `x_monthly_limit integer`, `x_balance_micros bigint`, `x_reserved_micros bigint`, `updated_at`, `version`.

PK `(workspace_id,environment)`, FK al workspace. Solo live tiene cargos; test conserva límites técnicos sin saldo comercial. Estados active|expired|suspended. Dinero en microdólares USD, nunca float. CHECK de límites y saldos no negativos, reserved <= balance y valid_until > valid_from cuando existe. Saldo disponible = balance - reserved; un cargo reduce balance y reserved en la misma transacción. Se bloquea esta fila para cuotas, activaciones, saldo y límite de cuentas concurrentes. Al confirmar una conexión se cuenta solo cuentas activas del tenant y entorno, bajo el mismo lock. Las concesiones del piloto tienen fecha final explícita. Las fechas pagadas no reinician los contadores mensuales UTC.

### 8.10 `publication_usage_reservations`

Campos: `id`, `workspace_id`, `environment`, `publication_id uuid`, `submission_generation integer`, `quota_period_start date`, `quota_bucket text`, `quota_state text`, `quota_source_id uuid?`, `cost_class text?`, `tariff_version text?`, `customer_price_micros bigint`, `money_state text`, `created_at`, `updated_at`, `version`.

FK compuesta a Publication; `UNIQUE(publication_id,submission_generation)`. Buckets x|non_x, cuota reserved|consumed|released|reused, dinero not_applicable|reserved|captured|released. CHECK generation > 0 y precio >= 0. USD 0,02 son 20.000 micros; USD 0,25 son 250.000. La reserva de cuota se imputa al mes UTC de aceptación y se convierte al primer dispatch. Cada Publication solo consume una unidad de su cuota aunque haya retries o generaciones nuevas; una generación posterior usa quota_state=reused y quota_source_id con FK compuesta a la reserva original consumida del mismo destino, sin incrementar consumo. Índice único parcial por publication_id sobre quota_state reserved o consumed impide una segunda unidad vigente del mismo destino. Si la reserva anterior se liberó sin dispatch, el retry crea una reserva en el mes de su nueva aceptación. La reserva de dinero X sí es independiente por generación y congela tarifa y categoría. Una edición previa al dispatch ajusta la reserva atómicamente. Todo retry manual incrementa submission_generation antes de crear la nueva reserva; los automáticos conservan la anterior. Una fila cuyo dinero esté capturado o liberado no se reabre: los ajustes generan movimientos nuevos auditados.

Al aceptar se incrementan reservas de cuota y saldo junto a esta fila, Publication y outbox. Una resolución o un job duplicado compara estado/version antes de capturar o liberar. unknown conserva el dinero reservado. Ninguna liberación por error se interpreta como prueba de no publicación. Una evidencia tardía tras liberación requiere ajuste operativo, no un débito ciego.

### 8.11 `commercial_ledger`

Campos: `id`, `workspace_id`, `environment`, `operation_key text`, `entry_type text`, `external_payment_reference text?`, `reservation_id uuid?`, `amount_micros bigint`, `plan_snapshot jsonb?`, `actor_reference text`, `reason text`, `created_at`.

Append-only. Tipos payment_credit|access_activation|pilot_grant|reserve|capture|release|adjustment. `UNIQUE(workspace_id,environment,operation_key)` hace idempotente cada movimiento. Índice único parcial global en external_payment_reference para el ingreso de cada pago externo: una referencia canónica con prefijo del procesador solo se registra una vez aunque incluya plan y saldo, en una entrada de pago que conserva el desglose; sus efectos hijos usan operation_keys derivadas sin repetir esa referencia. FK compuesta a reserva cuando exista. Solo el operador registra pagos, activaciones y ajustes. La API y worker registran reservas y outcomes a través del caso de uso transaccional. No guardar tarjetas, secretos ni payloads completos del procesador.

Cuotas consumidas, reservas y saldo son proyecciones verificables del ledger y de las reservas por destino. Una reconciliación compara esas fuentes antes de habilitar escrituras tras restore; jamás acredita de nuevo un pago por recuperar un backup antiguo. La retención comercial se define y publica antes del primer cobro, separada de logs y contenido. Conservar solo identificadores, importes y referencias mínimos para esa retención; el borrado de contenido no borra ni duplica movimientos comerciales. No copiar texto ni media al ledger.

## 9. Restricciones críticas como SQL de referencia

Los fragmentos ilustran obligaciones de las migraciones. No son un archivo ejecutable completo ni declaran tablas ya creadas:

```sql
ALTER TABLE posts
  ADD CONSTRAINT posts_tenant_id_unique
  UNIQUE (workspace_id, environment, id);

ALTER TABLE social_accounts
  ADD CONSTRAINT social_accounts_tenant_network_unique
  UNIQUE (workspace_id, environment, id, network);

ALTER TABLE publications
  ADD CONSTRAINT publications_post_same_tenant
  FOREIGN KEY (workspace_id, environment, post_id)
  REFERENCES posts (workspace_id, environment, id)
  ON DELETE RESTRICT;

ALTER TABLE publications
  ADD CONSTRAINT publications_account_same_tenant_network
  FOREIGN KEY (workspace_id, environment, social_account_id, network)
  REFERENCES social_accounts (workspace_id, environment, id, network)
  ON DELETE RESTRICT;

CREATE UNIQUE INDEX publications_one_active_destination
  ON publications (post_id, social_account_id)
  WHERE status IN ('scheduled', 'queued', 'publishing', 'retry_scheduled', 'unknown');

ALTER TABLE publications
  ADD CONSTRAINT published_has_receipt
  CHECK (status <> 'published'
    OR (published_at IS NOT NULL AND
      (external_id IS NOT NULL OR external_url IS NOT NULL
       OR confirmation_evidence IS NOT NULL)));

ALTER TABLE publications
  ADD CONSTRAINT missed_never_dispatched
  CHECK (status <> 'missed'
    OR (missed_at IS NOT NULL AND dispatch_started_at IS NULL));

CREATE UNIQUE INDEX publication_one_active_attempt
  ON publication_attempts (publication_id)
  WHERE outcome IS NULL;
```

Un trigger impide cambiar cuenta y red tras insertar Publication. Solo una edición scheduled anterior al claim cambia snapshot, y exige crear publication_revisions y actualizar content_version en esa misma transacción. Otro valida transiciones y la coherencia de estado de dispatch. No permitir `UPDATE status='pending'` arbitrario desde las herramientas de operación. El modo de repair usa un caso de uso auditado.

## 10. Transacciones de dominio

**Aceptar un Post.** Bloquear derechos comerciales, cuota y Post en ese orden consistente, validar vigencia, saldo, límites, versión, conflictos activos e intención de republish; obtener cuentas y media dentro del tenant; insertar Publications, media efectivas, reservas de uso y movimientos comerciales; fijar submittedAt si aún no existe; insertar eventos y outbox; completar idempotencia; commit. Un destino inválido revierte el lote entero.

**Claim frente a cancel.** Ambos actualizan Publication bloqueada. Cancel requiere estado cancelable y ausencia de claim activo. Claim requiere fecha vencida y CAS sobre versión. Solo uno gana. No mantener el lock durante HTTP.

**Resultado.** Comparar executionToken e intento; persistir outcome e historial, cambiar estado y versión y generar evento y outbox juntos. Respuesta tardía va a evidencia y reconciliación si ya no es el intento activo. first_outcome_at se fija solo al primer published, failed, missed o unknown de esa Publication y nunca se reinicia en retries; permite cohortes de métricas sin doble conteo. error_attribution se limita a platform|provider|account|content.

**Conexión social.** Consumir intento, seleccionar solo cuentas descubiertas, escribir conexiones y cuentas y emitir evento juntos. Persistencia de credencial queda cifrada desde el primer almacenamiento durable.

**Desconexión.** Bloquear cuenta, marcar desconectada, cancelar destinos elegibles y generar eventos. Intentos ya autorizados se siguen hasta un outcome real. No declarar cancelado un envío con resultado desconocido.

## 11. Consultas y estado agregado

GET Post usa una consulta consistente de sus Publications y calcula estado mediante la precedencia exhaustiva del PRD. Devuelve además conteos por estado y flag de atención. No se mantiene un `posts.status` como segunda autoridad. Filtrar por estado de Post usa el mismo predicado; una futura proyección debe conservar esa equivalencia y tolerancia de atraso explícita.

No filtrar únicamente por email o owner en cada join: el filtro obligatorio es workspace y entorno. Cursores incluyen el tenant y filtros en su firma. EXPLAIN en P2 debe demostrar que listados acotados y búsqueda de trabajo vencido usan los índices previstos.

## 12. Migraciones y datos futuros

Orden previsto:

1. Users y workspaces con bootstrap de operador.
2. API keys y límites de acceso.
3. Conexiones, intentos OAuth, sesiones cortas de conexión, cuentas y grants de key. Las FK diferidas o circulares se añaden después de crear ambos extremos.
4. Media con origen y sanitización, Posts y relaciones draft.
5. Publications, revisiones, snapshots de media, intentos, resoluciones, FK diferida e índices de dispatch.
6. Idempotencia, eventos, outbox y store del SDK si el spike lo exige.
7. Webhooks, auditoría, rate limits, presupuestos de proveedor, cuotas por workspace, derechos comerciales, reservas de uso, ledger y solicitudes de borrado. Instalar schema de jobs por su mecanismo oficial.

Cada cambio tiene migración versionada, prueba de DB vacía y upgrade desde la versión anterior con datos. No editar una migración aplicada. Expandir estados antes de desplegar código que los escribe; contraer solo cuando todos los lectores y workers sean compatibles. Workers deben detenerse durante cambios incompatibles y durante restores.

Una futura plataforma self-serve puede añadir checkout, suscripciones y membresías sin mover ownership ni reemplazar el registro comercial del MVP. La asistencia IA puede añadir revisiones y sesiones de edición separadas; no reutilizar PublicationAttempt para una llamada a un LLM. Los proveedores y modelos futuros no pertenecen a las tablas de conexiones sociales.
