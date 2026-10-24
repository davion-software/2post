# Guía de trabajo para agentes en 2post

## Empezar una tarea

Revisa `git status` y conserva los cambios ajenos al encargo. Lee el [README](README.md) para conocer el estado ejecutable. Usa [PRD](docs/PRD.md) para alcance, [TRD](docs/TRD.md) para contratos, [Schema](docs/BACKEND-SCHEMA.md) para persistencia y [Plan](docs/IMPLEMENTATION-PLAN.md) para el orden de entrega. El [plan comercial](docs/COMMERCIAL-PLAN.md) define cuotas y prepago. El antiguo repositorio Django `thedavos/2post` no es una autoridad.

El repositorio tiene una base de API, worker y migraciones. Consulta el código antes de afirmar que autenticación, publicaciones, jobs o MCP están implementados. Distingue diseño objetivo, pruebas simuladas y capacidades verificadas en redes reales.

## Preparar y comprobar el entorno

Usa las versiones fijadas de Node y pnpm. Activa `.nvmrc` con `nvm use` si utilizas nvm. Ejecuta `pnpm dev:setup`, `pnpm dev:doctor` y `pnpm dev`. El setup conserva `.env` y los datos existentes. No copies el ejemplo sobre una configuración local ya creada.

Si pnpm rechaza el runtime, `node scripts/doctor.mjs --json` devuelve el diagnóstico sin necesitar que pnpm ejecute un script. Los detalles de cada comando están en el README.

Usa pnpm y conserva su lockfile. Vite+ proporciona Oxlint, Oxfmt y Vitest. Actualiza dependencias mediante el catálogo y conserva los aliases y overrides generados. `pnpm-workspace.yaml` administra herramientas; el proyecto tiene un único paquete.

## Ubicar el cambio

Lee [ARCHITECTURE.md](docs/ARCHITECTURE.md). Añade funcionalidades dentro de `src/modules/<nombre>/`, con las capas que necesiten. Usa `*.contracts.ts` para contratos entre módulos. El código de un módulo no importa los archivos internos de otro; las relaciones entre schemas son una excepción explícita.

Los controladores delegan en casos de uso. Dominio, aplicación y contratos no dependen de Nest, ORM, adapters ni DTOs de proveedores. REST y MCP comparten casos de uso, permisos e idempotencia. No crees módulos ni capas vacíos.

La composición vive en los entrypoints, bootstrap y módulos Nest. La infraestructura común queda en `src/adapters/`, `src/config/` y `src/observability/`. La API acepta intención y el worker ejecutará trabajo durable. Conserva sus ciclos de vida separados.

Mantén CommonJS y resolución NodeNext. Conserva `experimentalDecorators` y `emitDecoratorMetadata`. El backend se compila con `nest build`; los tests de Nest cargan el código emitido mediante `test/helpers/compiled.ts`. Vite+ no sustituye ese build por un bundle de frontend.

## Elegir la verificación

- Código: `pnpm check`.
- Persistencia, composición o ciclo de vida: `pnpm verify`, con PostgreSQL y Docker preparados.
- Reglas de herramientas: `pnpm tooling:check`, además de `pnpm check`.
- Solo documentación: `pnpm format:check` y revisión de referencias.

`pnpm verify` ejecuta las comprobaciones completas sin repetir la compilación de cada suite. Las pruebas no publican en redes reales. Añade pruebas de comportamiento para los riesgos del cambio: aislamiento, autorización, idempotencia, concurrencia o recuperación de fallos.

Al modificar Fallow, comprueba ambas configuraciones. Los errores de arquitectura bloquean; un informe de complejidad no sustituye el tipado ni una prueba funcional. Conserva las severidades existentes salvo que el encargo las cambie. Las pruebas con fallos deliberados deben demostrar que las reglas detectan el problema.

## Preservar datos y secretos

El workspace, entorno y permisos deben proceder de una credencial verificada en servidor. Un `workspaceId` del body no concede acceso. `NODE_ENV=test` no sustituye el aislamiento de recursos entre `test` y `live`.

Edita schemas y genera una migración nueva con `pnpm db:generate`. Revisa SQL, snapshot y journal. Comprueba `pnpm db:check` y la integración contra una base separada. Conserva FK, índices y restricciones; las escrituras deben actualizar `updated_at` y la versión. Las migraciones se ejecutan por separado con permisos propios en producción.

Al implementar publicaciones, guarda intención, snapshots, idempotencia y outbox transaccionalmente. PostgreSQL conserva el estado público. Un timeout tras dispatch puede producir `unknown`; no permite repetir una publicación automáticamente.

Mantén secretos fuera del repositorio y logs. No registres credenciales, cuerpos de publicaciones ni errores de proveedores sin sanitizar. Las credenciales sociales se cifran desde su primer almacenamiento. `secrets:check` respeta los archivos locales ignorados y oculta los valores de sus hallazgos.

## Entregar el cambio

Escribe prosa en español e identificadores en inglés. Mantén README y documentos de diseño alineados con los cambios. Registra en [ADRs](docs/adr/README.md) las decisiones de arquitectura que necesiten explicar una alternativa o una restricción poco visible.

Explica qué cambió, qué comprobaste y qué sigue pendiente. No declares una fase completa por crear tablas, carpetas o handlers.

<!-- fallow:setup-hooks:start -->

## Usar Fallow

Fallow está fijado como dependencia de desarrollo. Usa `pnpm exec fallow` para invocarlo. Las skills de `.agents/skills/` enlazan las instrucciones de la versión instalada. El MCP de `.codex/config.toml` depende de la confianza del proyecto y de que el cliente lo cargue; la CLI funciona directamente.

- Antes de editar una dependencia entre capas: `pnpm exec fallow guard <archivo>`.
- Después de cambiar imports: `pnpm architecture:check`.
- Antes de borrar un export: `pnpm exec fallow dead-code --trace <archivo>:<export>`.
- Para investigar un recorrido entre archivos: `pnpm exec fallow trace --path <origen> <destino>`.
- Para revisar un cambio respecto a un commit existente: `pnpm exec fallow audit --base <ref>`.

Las comprobaciones obligatorias del repositorio están en `pnpm check` y `pnpm verify`, y se ejecutan también en CI. Esta configuración no instala hooks de commit o push.

<!-- fallow:setup-hooks:end -->
