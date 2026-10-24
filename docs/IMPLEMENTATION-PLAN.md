# 2post: plan de implementación

Versión: 0.3. Fecha: 2026-10-21. Estado: base ejecutable inicial incorporada el 2026-10-22; ninguna fase completada. P0 y los casos de negocio de P1 siguen pendientes.

Este plan implementa el [PRD](PRD.md) mediante los contratos del [TRD](TRD.md) y el [Backend Schema](BACKEND-SCHEMA.md). Partió de un repositorio con README y documentación. La inicialización posterior aporta API, worker, configuración, PostgreSQL local y migración inicial; no provisiona infraestructura de producción ni demuestra las puertas de P0. Incluye acceso de pago con cobro externo, activación manual, cuotas y prepago de X. La facturación automatizada, UI editorial y asistencia IA quedan para después.

## 1. Resultado y etiquetas de entrega

El piloto permite a un consumidor invitado conectar al menos una cuenta real, publicar texto e imagen, programar, cancelar lo pendiente, consultar resultados y recibir webhooks, tanto por REST como desde un cliente MCP de referencia. Todas las redes objetivo se ejercitan además en test con efectos simulados.

El MVP completo exige las tres redes X, LinkedIn y Bluesky verificadas en live, los escenarios E2E del PRD y un cliente MCP remoto conocido. La compatibilidad de Muse, Grokbot u otros agentes personales se prueba por separado y no bloquea el MVP. Una aprobación pendiente de LinkedIn, falta de presupuesto de X o cliente incompatible no se convierte en un test aprobado. Se etiqueta piloto parcial y se registra el gate pendiente.

Cada fase termina con una entrega comprobable. No se asignan fechas de calendario antes de medir el primer flujo y conocer aprobaciones externas. No se mide progreso por cantidad de tablas o endpoints creados.

## 2. Decisiones tomadas y pendientes antes de live

El founder resolvió Q-01 a Q-11 el 2026-10-21 (PRD §18 y §19). Consecuencias para el plan:

- Social SDK es `@opencoredev/social-sdk`, solo con adapters directos. La aplicación usa Node.js 24 LTS y CommonJS con resolución nodenext; el SDK ESM se carga con import() nativo en su adapter.
- Muse y Grokbot no bloquean el MVP. El contrato MCP se valida con el cliente de referencia y un cliente remoto conocido.
- Programadas: ventana de 15 minutos, `late` como atributo y `missed` como estado terminal.
- Imágenes: sanitización de metadatos por defecto; entrada binaria, multipart, URL y `mediaId`.
- LinkedIn solo con perfiles personales, con `accountType` desde la primera migración.
- La misma cuenta en varios workspaces, con autorización independiente.
- Producción en AWS `us-east-1`; retención del TRD con borrado a solicitud.
- Bluesky con facets de enlace y offsets UTF-8.

Pendientes que bloquean habilitar live, pero no documentar ni construir en test:

- Comprar los USD 50 iniciales de créditos de X aprobados y configurar topes USD 90 interno y USD 100 en consola, sin recarga automática. Sandbox tiene 0 X live; Builder y Pro usan prepago X separado. Son tareas de lanzamiento, no compras realizadas.
- Verificar acceso real a endpoints, cuotas y condiciones comerciales de X antes del lanzamiento.
- Aprobación de la app de LinkedIn para publicar en perfiles de miembro.
- Cuenta AWS, dominio HTTPS y callbacks registrados en cada red (G-06), política de privacidad y términos (G-07).

Las puertas G-01 a G-07 del PRD son el registro de referencia. La investigación no satisface una puerta de prueba real.

## 3. P0: resolver los riesgos antes del scaffold completo

Requisitos: GW-01 a GW-04, NET-01/02, MCP-01/02/13 y G-01 a G-07. No tiene dependencias internas.

Trabajo:

1. Ejecutar un spike de `@opencoredev/social-sdk` con adapters directos y versión fijada, desde una aplicación NestJS CommonJS sobre Node.js 24 LTS y TypeScript nodenext, con mocks deterministas. Registrar contratos de preparación, publicación, credenciales y resultados. Verificar import() nativo del SDK ESM en el JS emitido, nest build y node dist/entrypoints/api.js; repetir para worker. Comprobar Drizzle, pg-boss, SDK MCP y metadata de decoradores con el test runner.
2. Demostrar que timeout tras dispatch se puede mapear a unknown sin retry oculto del SDK o cliente HTTP. Si el paquete deduplica, comprobar su store durable y cómo autoriza un retry tras no-escritura confirmada.
3. Conservar platform-fastify según TRD §1.1. Antes de reconsiderar platform-node, verificar publicación estable, compatibilidad funcional y medición representativa. Verificar NestJS con Fastify y el SDK MCP para la revisión objetivo 2026-07-28. Probar initialize, tools/list, tools/call, errores y autenticación estática. Si no se soporta esa revisión, fijar una anterior implementada de forma completa y registrar la decisión antes de seguir.
4. Probar la transacción de pg-boss con PostgreSQL y Drizzle, o demostrar outbox con enqueue repetido. No confiar solo en el nombre del adapter.
5. Crear la matriz de red/adapter/formato/tipo de cuenta/permisos/reconexión/reconciliación, y la matriz de clientes MCP. Registrar no verificado donde corresponda.
6. Elegir y fijar la librería de imagen (propuesta: sharp) y demostrar con una foto real que la recodificación elimina EXIF y GPS, aplica la orientación y conserva el perfil de color.

Entregables: decisiones técnicas con versiones fijadas, pruebas del spike, registro de gates y matriz de compatibilidad. El spike puede eliminarse después de incorporar sus pruebas útiles.

Criterio de salida: existe una ruta de implementación para texto e imagen sin ocultar efectos inciertos, un cliente MCP de referencia puede invocar una tool protegida y el mecanismo de jobs confirma atomicidad local. Si falta acceso a redes, se continúa en test y esa red permanece unavailable en live.

## 4. P1: arrancar el servicio con ownership y permisos

Requisitos: IDN, KEY, ENV, SEC-01 a SEC-04, EXT-01. Depende de P0.

Trabajo: crear un paquete TypeScript con API NestJS/Fastify, worker y config validada. Fijar un patch de Node.js 24 LTS, aplicación CommonJS y TypeScript nodenext, package manager y lockfile. Usar Vitest con metadata de Nest comprobada o tests sobre el build compilado. Añadir PostgreSQL local, migraciones iniciales, logging redactado, readiness y shutdown ordenado.

Implementar bootstrap de operador con User, Workspace y keys administrativas de test y live mostradas una vez. Implementar GET /v1/me, gestión de keys con restricción de privilegios, presets y allowlist de cuentas. Contexto workspace/entorno se construye desde credencial verificada. Prohibir cualquier llamada social desde test.

Implementar derechos comerciales por workspace, presets de [planes](COMMERCIAL-PLAN.md), límite de cuentas y registro manual de pagos con referencia idempotente. La operación pertenece al operador autenticado, sin endpoint público ni scope de API key que permita autoacreditar saldo. GET /v1/me expone vigencia, cuotas y saldo.

Verificación: dos workspaces y dos entornos, key revocada, expirada y scope insuficiente, hija que intenta ampliar grants, última admin y secretos sembrados en logs. E2E-01, E2E-02 y E2E-12 deben tener resultados concretos, no handlers vacíos.

Criterio de salida: el consumidor recibe una key restringida que no puede ver ni modificar datos del otro tenant o entorno; no hay ruta pública de bootstrap. Nuevas migraciones funcionan en DB vacía y actualización desde la fase anterior.

## 5. P2: completar un flujo de texto en test

Requisitos: ENV-03, TGT, PST, PUB-01 a PUB-04, IDM, ERR, STA y NET-01. Depende de P1.

Trabajo:

- Implementar SimulatedGateway con success, fail_permanent, fail_retryable_then_success, rate_limited, timeout_unknown y reconnect_required.
- Crear cuentas test y default visible por red. Resolver solo accountId o default explícita dentro de allowedAccountIds.
- Implementar Post y overrides completos, validate sin efectos y creación transaccional de Publications y revisions.
- Implementar endpoints de publicación, programación, listados y cursores. Compartir DTOs contractuales, validación y errores sin importar tipos de providers al dominio.
- Implementar idempotencia durable de 7 días y su replay tras commit aunque se pierda la respuesta HTTP.
- Calcular estado agregado mediante la tabla exhaustiva del PRD. Exponer publicationCounts y needsAttention para no ocultar unknown mientras otro destino sigue activo.

Verificación: una red inválida revierte todo el lote; una key restringida no usa otra cuenta; mismo request REST repetido tiene mismos IDs; key reutilizada con otro endpoint o body falla; Post editado no cambia snapshots; combinaciones de estados siempre tienen agregado. Cubrir E2E-07/08/09 y el núcleo de E2E-03 sin media aún.

Criterio de salida: se acepta una intención una vez, se consulta su destino y snapshot exacto y ninguna llamada sale a internet. La fase no se considera publicación real.

## 6. P3: ejecutar, recuperar y cancelar sin retry ciego

Requisitos: EXE, PUB-05 a PUB-10, STA, RL y OBS. Depende de P2.

Trabajo: añadir jobs pg-boss, outbox, scheduler y barrido reparador. Claim atómico con token, lease inicial de 120s y límite por cuenta. Persistir dispatchStartedAt antes de create, con deadline HTTP de 30s y retry de mutación deshabilitado. Separar retry de entrega del job y autorización de un nuevo envío social.

Implementar retry_scheduled solo ante no-escritura demostrada, calendario 5s/30s/2m/10m, Retry-After, presupuesto y abandono previo a dispatch. Guardar outcomes terminales inmutables, resoluciones append-only y metadata de generaciones con riesgo reconocido. Resolver y reconocer unknown solo por REST con permisos administrativos; no convertir una búsqueda vacía en prueba.

Implementar cancelación contra claim y PATCH de scheduled con revisión nueva, conservación de anterior y revalidación de jobs atrasados. Un job previo no puede ejecutar una versión antigua ni ignorar una fecha nueva.

Implementar la ventana de tolerancia de 15 minutos en el claim y en el barrido del scheduler: `late` como atributo con `lateBySeconds`, `missed` como estado terminal sin attempt de dispatch, evento `publication.missed` y retry manual desde `missed`. Ventana y umbral son configuración. Añadir la cuota de X por workspace y el presupuesto por app de proveedor (COST-02/03), cuotas compartidas no-X, reservas de prepago por generación y ledger idempotente según COM y TRD §8.5. Verificar carreras, ediciones, expiración, unknown y retry reconocido, con E2E-19.

Verificación mediante inyección de fallos:

1. Caída antes de commit de aceptación: no hay intención parcialmente aceptada.
2. Caída tras commit antes de enqueue: el reparador encuentra el trabajo.
3. Enqueue duplicado: no duplica envío.
4. Lease vencido antes de dispatch: otro worker recupera; el anterior no obtiene permiso tardío.
5. Caída tras marca de dispatch o después de éxito remoto antes de persistir: unknown, sin segundo create.
6. Proveedor devuelve accepted/processing: polling de lectura, sin crear de nuevo.
7. Timeout y resultado tardío: evidencia atribuida al intento original, sin sobrescribir otra generación.
8. Cancel y reprogramación concurrentes con claim: un ganador y respuesta coherente.
9. Dos jobs de la misma cuenta y cientos de cuentas distintas: límites correctos y ningún dispatch anticipado.
10. Caída simulada de 10 y 20 minutos con programadas vencidas: `late` y `missed` respectivamente; una inmediata encolada se reconcilia antes de decidir.
11. Cuota de workspace agotada y tope global de presupuesto: rechazo sin Publications parciales.

Criterio de salida: E2E-04/05/06/13/17, tests de crash y estado agregado pasan, incluido reporte explícito del riesgo en retry manual de unknown. Medir cantidad real de llamadas create en el proveedor simulado, además de filas en DB.

## 7. P4: conectar y publicar en la primera red real

Requisitos: ACC, GW, NET, SEC y E2E-10. Depende de P3 y de la puerta de la red elegida.

Trabajo: implementar connectUrl de un solo uso, pantalla mínima con workspace/entorno/red, confirmación POST, cookie corta, state, PKCE cuando aplique y callback durable. Un scanner que abre el enlace no lo consume. Descubrir y seleccionar cuentas verificadas; almacenar secretos cifrados desde el primer write.

Implementar SocialGateway real por red como wrapper del adapter directo de Social SDK, con credenciales de app configurables: las de 2post en hosted o las del operador en self-hosted. Conexión, token refresh, cuentas y clasificador de outcomes comparten contratos con test. No hacer fallback automático a otro adapter o cuenta tras un envío ambiguo.

Verificación: callback repetido, state caducado, cuenta diferente durante reconexión, misma cuenta externa en dos workspaces (E2E-16), dos refresh simultáneos y pérdida de respuesta durante rotación. Confirmar publicación real de texto en una cuenta controlada, ID y enlace. Borrar el post de prueba solo mediante una operación explícita del humano; no incluir remote delete de producto por conveniencia del test.

Criterio de salida: una red verificada para texto, reconexión y errores, con evidencia sin secretos. Todavía no declarar esa red disponible para el MVP completo hasta verificar imagen en P5.

## 8. P5: incorporar imágenes y cerrar capacidades de la red

Requisitos: MED, PST-05/06, NET-02 y E2E-03/10. Depende de P2 y P4 para verificación live.

Trabajo: carga binaria y multipart por streaming, preparación única que elimina EXIF y GPS conservando orientación y color, almacenamiento privado y validación real de bytes y metadata. Para el MVP completo, importación por URL con el egress protegido de webhooks. Limitar a una imagen JPEG/PNG/WebP hasta 5 MiB globales y al subconjunto real de cada adapter. Persistir MediaRef y altText por revisión, fijar versión inmutable y mantener retención para scheduled/unknown.

El worker prepara upload específico cerca de la ejecución. No guardar una signed URL de corta vida como si fuera un asset válido por 365 días. No transformar texto o imagen en silencio: la sanitización es la única transformación de imagen y se expone como `metadataStripped`.

Verificación: MIME falso, archivo corrupto, imagen demasiado grande, media ajena, hueco entre upload y persistencia, URL expirada, imagen eliminada o retenida, default de contenido y override sin media, foto con GPS, orientación rotada e ICC (E2E-14), y URL hacia IP privada, redirect o rebinding (E2E-15). Publicar texto+imagen real y abrir el resultado; registrar capacidad y versión del adapter.

Criterio de salida: primera red available para el conjunto comprometido, incluidas imagen y reconexión. Se completan las variantes con media de los escenarios test.

## 9. P6: entregar webhooks y recuperar eventos

Requisitos: WHK, SEC-05, OBS y E2E-03/10. Depende de P3; puede desarrollarse mientras se resuelven permisos externos de P4.

Trabajo: endpoints, secretos cifrados de un solo retorno, eventos de transición en la misma transacción, fanout durable, delivery history y rotación con dos firmas durante 24h. Añadir feed GET /v1/events y evento individual con retención de 30 días; el histórico técnico puede tener retención distinta sin exponerlo por esa API.

El receptor recibe metadata pública mínima y versión, firma sobre bytes estables y eventId conservado en retries. Implementar HTTPS sin redirects, resolución y pinning de IP pública IPv4/IPv6 por conexión, límites de tiempo y respuesta. Deshabilitar endpoints tras la política de fallos, sin borrar evidencia.

Verificación: firma alterada, timestamp viejo, reordenamiento y duplicados, crash tras transición, endpoint privado o rebinding, endpoint revocado con entregas pendientes, rotación y replay del mismo evento. Contar la firma y el resultado del receptor, no solo el enqueue.

Criterio de salida: consumidor procesa una vez un evento entregado varias veces y recupera desde feed el que perdió. Un fallo de webhook nunca cambia el resultado social ni publica otra vez.

## 10. P7: poner el mismo flujo en manos de un agente

Requisitos: MCP, PR-01, E2E-07/08/11/12. Depende de P2/P3, P5 para imágenes y spike MCP P0.

Trabajo: implementar catálogo completo PRD §10.2 sobre los mismos casos de uso, con JSON Schemas, resultado estructurado y resumen, idempotencyKey y permisos revalidados por tool. publish crea un Post; publish_post opera uno existente. No ofrecer resolve ni retry desde unknown.

Completar upload_image (base64, 2 MiB decodificados) e import_image (sourceUrl por el egress protegido) con la preparación compartida. Documentar la alternativa REST para archivos mayores. No aceptar secretos sociales en tools.

Prueba en cliente de referencia: bootstrap externo, whoami, listar cuentas, conexión humana, crear, validar, publicar, programar, reprogramar, cancelar y consultar. Repetir la intención REST por MCP con la misma key idempotente para demostrar que no hay dos operaciones distintas. Scope reducido oculta o rechaza tool y cuenta ajenas.

Validar después con un cliente MCP remoto conocido. Las pruebas en Muse, Grokbot u otros agentes personales se documentan aparte, con build, fecha, transporte, revisión y auth, y no bloquean el MVP. Si un agente no acepta el header, registrar la incompatibilidad concreta. OAuth remoto o stdio se planifican como extensión de interoperabilidad antes de prometer soporte; no cambiar auth de forma improvisada.

Criterio de salida: E2E-11 del piloto demostrado; datos MCP y REST coinciden; la matriz no afirma compatibilidad de clientes que no se probaron.

## 11. P8: abrir el piloto y medir fiabilidad

Requisitos: MET, OBS, RL y todos los E2E de fase P. Depende de P1 a P7 y gates de al menos una red.

Trabajo: desplegar en AWS `us-east-1` API, worker, PostgreSQL y almacenamiento de objetos en la misma región, con red privada y permisos separados, KMS para credenciales, backups cifrados, secretos externos, TLS y callbacks reales. Configurar presupuesto, alertas y tope de X antes del primer envío live. Preparar el cobro externo y runbook de verificación manual, activación, recarga, expiración y ajustes. Validar el primer ciclo de pago y concesiones acotadas del piloto sin crear una suite de facturación. Fijar y publicar retención de registros comerciales y condiciones de devolución antes del primer cobro. Registrar contadores por entorno y red, histogramas, alertas por unknown, retraso y webhook deshabilitado. Añadir runbook de retry seguro, reconexión, resolución manual, recuperación de DB, borrado a solicitud del owner y programadas `missed`.

Prueba de carga según TRD: 20 workspaces, 500 cuentas mock, 20 requests/s durante 10 min y burst de 500 programadas. Reportar hardware, concurrencia, p95/p99, errores y cuota por cuenta. Separar ese escenario de muchas publicaciones en una cuenta; un proveedor serializado no permite prometer throughput ilimitado.

Probar backup y restore con workers detenidos. Marcar inciertos los envíos que pudieron ocurrir después del recovery point; habilitar creación solo tras reconciliar. Probar que una key test en producción sigue sin efectos live.

Criterio de salida: E2E-01 a E2E-19 en alcance P, al menos una red completa en live, receptor webhook real, prueba MCP, operación observable y restore demostrado. Emitir informe con redes, límites, fallos pendientes y versión exacta. No anunciar las tres redes si solo se verificó una.

## 12. P9: completar las redes objetivo y el MVP

Depende de P8 y gates individuales G-01/02/03. Requisitos: todos los [M] del PRD, incluidas expiración de keys, refresh preventivo, retención, alertas, eventos, rotación de firma e imagen MCP.

Repetir P4/P5 por cada red faltante. Mantener perfiles personales en LinkedIn; las páginas de organización son una entrega posterior (ACC-11). Bluesky requiere tratar la sesión AT Protocol y claves asociadas como unidad; usar los facets de URL del adapter y probar offsets UTF-8 con emojis y texto multibyte sin cambiar el texto visible (E2E-18). Ningún adapter declara reconciliación o idempotentCreate por intuición: registrar evidencia concreta.

Observar métricas durante al menos 14 días del piloto. Las métricas móviles de 28 días se marcan como ventana parcial hasta completarla; no extrapolar 14 días a una disponibilidad contractual mensual. El founder acepta desviaciones conocidas o exige corregirlas. Reportar éxito bruto junto al éxito atribuible a 2post y contar unknown como no exitoso.

Criterio de salida: X, LinkedIn y Bluesky available en live para texto e imagen, E2E completos, objetivos medidos y un cliente MCP remoto conocido verificado. La compatibilidad de agentes personales se informa aparte. Solo entonces etiquetar MVP objetivo completo.

## 13. Trazabilidad y trabajo posterior

Cobertura principal por familia: IDN/KEY/ENV en P1; TGT/PST/IDM/ERR/STA en P2; PUB/EXE/RL en P3; ACC/GW/NET en P4 y P5; MED en P5; COST en P3 y P8; COM en P1, P3 y P8; RET y DEP en P8; WHK en P6; MCP en P7; SEC/OBS/MET se verifican de forma transversal y se cierran en P8/P9. EXT se conserva mediante ownership y límites de módulo, sin implementar el roadmap.

Cada entrega adjunta requisitos y AC cubiertos, migraciones, contrato OpenAPI actualizado, pruebas ejecutadas, resultado observable y gates pendientes. Un endpoint que devuelve un objeto fijo no satisface un AC de integración.

Después del MVP, abrir PRDs independientes para plataforma de pago self-serve y asistencia IA. La primera automatiza onboarding, identidad humana, checkout, suscripciones y renovaciones sobre el acceso comercial ya implementado. La segunda necesita elección de proveedor/modelo, credenciales API legítimas, presupuesto, privacidad y revisión humana del contenido resultante. La API de publicación sigue siendo la interfaz compartida.
