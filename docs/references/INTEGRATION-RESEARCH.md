# Verificación inicial de integraciones

Consultado el 2026-10-20 y actualizado el 2026-10-21 con las decisiones del founder. Investigación documental, sin instalar paquetes ni conectar cuentas. Ninguna publicación real ni compatibilidad de cliente está verificada. Las decisiones de diseño de los documentos principales son propuestas de 2post.

## Social SDK

El founder confirmó que Social SDK es [`@opencoredev/social-sdk`](https://github.com/opencoredev/social-sdk), de OpenCore, con [documentación oficial](https://social-sdk.dev/docs) y licencia MIT. Comprobado el 2026-10-21: la [guía de instalación](https://social-sdk.dev/docs/getting-started/installation) exige Node.js 22.12 o superior y declara un paquete ESM-only sin build CommonJS. El README lista adapters directos para Bluesky, Instagram, LinkedIn, Threads, TikTok, X y YouTube, y backends gestionados opcionales para Zernio, Post for Me, PostFast, Postiz y Buffer. 2post usa solo adapters directos.

Su [matriz de plataformas](https://social-sdk.dev/docs/platforms) declara publicación de texto e imágenes para X, LinkedIn y Bluesky. La matriz no certifica permisos, aprobación de aplicaciones ni éxito en producción. El SDK no provee por sí mismo hosting, persistencia, scheduler ni billing.

La [guía de publicación](https://social-sdk.dev/docs/publishing) distingue resultados por destino, incluida aceptación pendiente y resultado desconocido. El [modelo de idempotencia](https://social-sdk.dev/docs/concepts/idempotency) requiere almacenamiento durable para deduplicar llamadas y no garantiza deduplicación en APIs externas directas. Por ello, 2post conserva su propio estado e historial de intentos y debe verificar la semántica del SDK fijado antes de envolverlo.

La [guía de conexiones](https://social-sdk.dev/docs/authentication) separa identidad de la aplicación y autorización de cuentas sociales. La implementación debe verificar el almacenamiento durable de conexiones y la rotación de credenciales del paquete elegido. El mecanismo exacto de cada proveedor es una obligación del adapter, no un supuesto común del dominio.

## Redes

- [X: Create Posts](https://docs.x.com/x-api/posts/create-post). Existe el endpoint de creación `POST /2/tweets`. Confirmar acceso vigente, permisos, cuotas y comportamiento de timeout con la aplicación y cuenta del piloto. No inferir una garantía de idempotencia externa. La [tabla de precios](https://docs.x.com/x-api/getting-started/pricing) describe pago por uso sin contratos, suscripciones ni gasto mínimo. A 2026-10-21, `Post: Create` cuesta USD 0,015 por petición y `Post: Create (with URL)`, USD 0,200. Los precios pueden cambiar: registrar la fecha al configurar la tabla de COST-01.
- [LinkedIn: Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api). Publicación de miembro y organización usan permisos distintos. Decisión: perfiles personales en el MVP y páginas de organización en una fase posterior. Fijar una versión de API vigente durante el spike.
- [Bluesky: crear un post](https://docs.bsky.app/docs/tutorials/creating-a-post). La publicación usa registros AT Protocol. [OAuth de AT Protocol](https://atproto.com/specs/oauth) es la referencia para sesiones y autorización; no reducir una sesión a un par de tokens genéricos. Una estrategia de reconciliación por identidad de registro solo se habilita después de verificarla con el adapter concreto. La [guía del adapter Bluesky](https://social-sdk.dev/docs/platforms/bluesky) indica que crea facets de URL automáticamente, que las menciones requieren un DID resuelto con offsets en bytes UTF-8, y límites de 300 graphemes, 3.000 bytes y hasta cuatro imágenes de 2.000.000 bytes. Son valores documentales, a confirmar en G-03.

Mantener una matriz versionada en la fase de implementación con red, tipo de cuenta, formato, adapter y versión, permisos, reconexión, media, resultado incierto, evidencia y fecha de comprobación. No guardar secretos ni contenido privado en esa evidencia.

## MCP

La revisión publicada [2026-07-28 de Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) cambió detalles respecto a 2025-11-25. Seleccionar revisiones por negociación y probar los clientes reales. No equiparar el nombre del transporte con interoperabilidad probada.

La [especificación de autorización](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) define un recurso HTTP protegido mediante OAuth y credenciales de entorno para stdio. El PRD elige MCP remoto con API key estática para clientes con headers configurables. Un cliente que exige discovery y OAuth remoto necesita una entrega adicional; un bridge stdio también es una posibilidad futura. Estas alternativas no están implementadas. Los tokens de redes sociales nunca son credenciales del cliente MCP ni se pasan desde este al proveedor.

Muse y Grokbot son agentes personales. 2post es agnóstico al agente y no bloquea el MVP por ellos; sus builds, transportes y autorización se prueban y documentan por separado.

## Runtime y jobs

[NestJS soporta Fastify mediante un adapter](https://docs.nestjs.com/techniques/performance). Se conserva como base de 2post. Debe comprobarse la integración concreta del SDK MCP con Fastify sin middleware de Express accidental.

### Revisión de platform-node del 2026-10-21

La captura de LinkedIn aportada por el founder anuncia `@nestjs/platform-node`, construido sobre node:http, para una próxima versión menor. La promesa del anuncio no demuestra por sí misma disponibilidad estable. Se consultaron fuentes oficiales:

- [Release NestJS v12.2.0](https://github.com/nestjs/nest/releases/tag/v12.2.0), publicada el 2026-10-19: no incluye platform-node en sus notas.
- [Registro npm de platform-node](https://registry.npmjs.org/@nestjs%2fplatform-node): HTTP 404 con `{"error":"Not found"}` al consultar. Como control, [core/latest](https://registry.npmjs.org/@nestjs%2fcore/latest) respondió HTTP 200 con versión 12.2.0.
- [Lista de paquetes del repositorio oficial](https://api.github.com/repos/nestjs/nest/contents/packages): incluye platform-fastify y platform-express; no incluye platform-node a la fecha de consulta. La ruta master/packages/platform-node/package.json respondió 404.

La imagen muestra 55.618,97 req/s para Nest platform-node frente a 52.613,34 para Nest platform-fastify: `(55618.97 / 52613.34 - 1) * 100 = 5,71 %`. Son cifras de un test Hello world, no una medición de 2post ni evidencia de igual mejora con DB, OAuth, media o MCP. La fila fastify sin Nest es otra configuración. No se ejecutó un benchmark local ni se verificaron hardware, duración o dispersión del video. La conclusión de diseño es conservar Fastify y reevaluar tras publicación estable y pruebas representativas según TRD §1.1.

Comprobación reproducible de disponibilidad, sin instalar paquetes:

```sh
curl -sS -w '\n%{http_code}\n' 'https://registry.npmjs.org/@nestjs%2fplatform-node'
curl -sS 'https://registry.npmjs.org/@nestjs%2fcore/latest'
```

### Node.js y módulos

La [tabla oficial de releases de Node.js](https://nodejs.org/en/about/previous-releases), consultada el 2026-10-21, clasifica Node.js 24 como LTS. Es el runtime elegido para 2post, por encima del mínimo del SDK. El patch se fija en P0.

La [referencia de módulos de TypeScript](https://www.typescriptlang.org/docs/handbook/modules/reference.html#node16-node18-node20-nodenext) documenta que nodenext puede emitir CommonJS conservando import() nativo. En cambio, module=commonjs transforma import() en require(). La [nota de TypeScript 5.3](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-3.html#stable-support-resolution-mode-in-import-types) documenta resolution-mode para imports de tipos. Estas fuentes respaldan la estrategia de interoperabilidad del TRD; no sustituyen el spike de Nest y Social SDK. El diseño conserva Nest CommonJS y usa un provider asíncrono para cargar el SDK ESM únicamente en su adapter.


[pg-boss](https://pgboss.io/) es un candidato para jobs sobre PostgreSQL y documenta encolado transaccional. Se propone para evitar añadir Redis al piloto. La fase técnica debe fijar versión y probar el adapter de transacciones. La seguridad contra publicaciones duplicadas pertenece al estado de dominio y a su protocolo de envío, aunque el sistema de jobs entregue otra vez.

[PostgreSQL: SELECT](https://www.postgresql.org/docs/18/sql-select.html) documenta `FOR UPDATE SKIP LOCKED`, útil para reclamar trabajo. No se mantienen transacciones abiertas mientras responde una API social. Los leases internos no pueden impedir por sí solos una escritura externa de un worker que ya obtuvo autorización para enviar.

## Pendientes que bloquean una promesa pública

1. Probar con la versión fijada de Social SDK las capacidades efectivas de cada red.
2. Obtener y verificar acceso de publicación de cada red con cuentas de prueba controladas.
3. Probar texto, una imagen, reconexión y diagnóstico de outcomes inciertos por adapter.
4. Ejecutar la compra y los topes de X aprobados y verificar consumo real, incluidos media y polling. La [oferta inicial](../COMMERCIAL-PLAN.md) ya fija presupuesto y publicaciones gratuitas.
5. Documentar aparte la compatibilidad de Muse, Grokbot y otros agentes personales; no bloquea el MVP.
6. Elegir proveedor de identidad si se habilita MCP remoto con OAuth y onboarding público.
