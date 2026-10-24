# Documentación de 2post

Para trabajar en el código, consulta [el entorno local](../README.md), [los límites de arquitectura](ARCHITECTURE.md) y [las decisiones registradas](adr/README.md).

Estado: diseño propuesto del MVP y base ejecutable inicial del backend, actualizado el 2026-10-22. API y worker arrancan y existe una migración de users/workspaces. Los casos de negocio siguen pendientes; P0 y P1 no están completados. Ver [arranque y verificación local](../README.md).

1. [PRD](PRD.md): producto, alcance, requisitos con criterios de aceptación, piloto, métricas y roadmap.
2. [TRD](TRD.md): arquitectura, contratos REST y MCP, ejecución, seguridad y operación.
3. [Backend Schema](BACKEND-SCHEMA.md): entidades, relaciones, restricciones, índices y transacciones.
4. [Implementation Plan](IMPLEMENTATION-PLAN.md): fases, dependencias, pruebas y criterios de salida.
5. [Plan comercial](COMMERCIAL-PLAN.md): oferta inicial, presupuesto de X, cuotas, prepago y operación manual de pagos.

El [brief del founder](references/PRODUCT-BRIEF.md) conserva una síntesis del borrador de origen. La [investigación de integraciones](references/INTEGRATION-RESEARCH.md) distingue documentación consultada de soporte comprobado.

El PRD fue refinado por un subagente Claude Opus 5.5 con esfuerzo high. La revisión de integración posterior concilió los cuatro documentos y precisó procesamiento asíncrono remoto, evidencia de reconciliación y conservación de intentos terminales.

El founder resolvió las preguntas Q-01 a Q-11 el 2026-10-21 ([PRD §19](PRD.md#19-preguntas-resueltas-y-pendientes)). También aprobó la oferta y el presupuesto inicial de X: USD 50 en créditos, Sandbox con 0 X live y lanzamiento de pago con activación manual. Node.js 24 LTS y carga dinámica del SDK ESM sustituyen la propuesta de convertir todo el proyecto a ESM. Se conserva Fastify porque platform-node sigue anunciado, sin publicación npm verificada a esta fecha. Siguen siendo externos el acceso y los permisos de cada red, la verificación de capacidades de Social SDK, la cuenta AWS y el dominio de callbacks. Nada de esto impide revisar el diseño, pero sí afirmar soporte live.
