# Guía de trabajo para agentes en 2post

## Contexto y fuentes

2post es infraestructura de publicación social para aplicaciones y agentes mediante REST y MCP. Usa el estado real del código para describir lo implementado y los documentos para entender el diseño objetivo.

Lee las fuentes relevantes antes de cambiar código:

- [README](README.md): arranque, comandos y estado actual.
- [PRD](docs/PRD.md): alcance, requisitos y criterios de aceptación.
- [TRD](docs/TRD.md): arquitectura, contratos y operación.
- [Backend Schema](docs/BACKEND-SCHEMA.md): persistencia, restricciones y transacciones.
- [Implementation Plan](docs/IMPLEMENTATION-PLAN.md): orden de entrega y criterios de salida.
- [Plan comercial](docs/COMMERCIAL-PLAN.md): planes, cuotas y prepago de X.

El PRD gobierna el alcance; TRD y Schema precisan los contratos y la persistencia. Registra las discrepancias que afecten la tarea y mantén los documentos alineados con los cambios. El antiguo repositorio Django `thedavos/2post` no es una fuente de autoridad.

La base actual incluye API, worker, health checks, configuración y migraciones de usuarios/workspaces. Consulta el código antes de afirmar que existen autenticación, jobs, publicaciones o integraciones. La existencia de una tabla o un módulo no completa una fase del plan.

## Stack y dependencias

- Mantén un paquete TypeScript con API NestJS/Fastify y worker como procesos separados del mismo código.
- Usa las versiones de Node y pnpm fijadas en `.nvmrc`, `.node-version` y `package.json`.
- Usa pnpm y conserva `pnpm-lock.yaml`. Fija las nuevas dependencias y evita introducir otros lockfiles.
- Conserva CommonJS con `module` y `moduleResolution` en `NodeNext`, junto con la metadata de decoradores requerida por Nest.
- Drizzle y PostgreSQL ya están incorporados. pg-boss, Social SDK, MCP y almacenamiento de imágenes pertenecen al diseño y requieren validación antes de integrarlos.

## Límites de arquitectura

- `src/entrypoints/`: inicio de API, worker y migraciones.
- `src/bootstrap/`: composición y ciclo de vida de los procesos.
- `src/modules/`: responsabilidades de negocio y composición de módulos.
- `src/application/`: casos de uso y puertos independientes del framework.
- `src/adapters/`: implementación de persistencia y servicios externos.
- `src/interfaces/`: controladores REST y futuras herramientas MCP.
- `src/config/` y `src/observability/`: configuración, logs y correlación.

Añade `src/domain/` cuando existan reglas de dominio que lo necesiten. Dominio y aplicación no importan Nest, ORM, Social SDK ni DTOs de proveedores. ESLint comprueba parte de este límite; conserva también la dirección de dependencias al añadir código nuevo.

Los controladores delegan en casos de uso. REST y MCP comparten las mismas reglas, permisos e idempotencia. Los módulos se comunican mediante contratos explícitos; evita acceder a detalles internos de otro módulo salvo las relaciones de esquema previstas. Crea módulos y capas cuando tengan una responsabilidad concreta.

La API acepta y persiste la intención; el worker ejecutará publicaciones, programación, reconciliación y webhooks. Mantén su arranque y cierre independientes. La base actual del worker comprueba PostgreSQL, pero todavía no consume jobs.

## Persistencia y ejecución durable

- Edita los archivos `*.schema.ts`, ejecuta `pnpm db:generate` y revisa el SQL antes de aplicar `pnpm db:migrate`.
- Conserva SQL, snapshots y journal de Drizzle. Añade una migración nueva para cambiar un esquema ya aplicado.
- Ejecuta migraciones como un paso separado de API y worker. Usa permisos de migración separados en producción.
- Mantén FK, índices y restricciones del Schema; actualiza `updated_at` y la versión en las futuras operaciones de escritura.
- Comprueba las migraciones en una base vacía y las actualizaciones desde el esquema anterior cuando corresponda.
- Al implementar publicaciones, persiste estado, snapshots, idempotencia y outbox de forma transaccional. PostgreSQL conserva la autoridad del estado público.
- Un timeout después de iniciar el envío puede significar `unknown`. No autoriza repetir la creación social. La redelivery de un job y el permiso para volver a publicar son decisiones distintas.

## Aislamiento y secretos

El acceso futuro debe obtener workspace, entorno y permisos de una credencial verificada en servidor. Un `workspaceId` enviado por el cliente no concede acceso. Mantén el aislamiento en consultas, escrituras, jobs y relaciones de base de datos.

El entorno de producto `test` usa cuentas y adapters simulados. Las pruebas automatizadas no publican en redes reales. `NODE_ENV=test` es configuración del proceso y no sustituye el aislamiento de recursos por entorno de producto.

Mantén secretos fuera del repositorio y de los logs. Usa `.env.example` para documentar variables con valores locales o de ejemplo. Conserva la validación de configuración y evita registrar cabeceras de autorización, cookies, URLs con credenciales, cuerpos de publicaciones o errores de proveedores sin sanitizar. Las credenciales sociales se cifrarán desde su primer almacenamiento.

## Desarrollo y verificación

Ejecuta los comandos desde la raíz del repositorio. Crea `.env` desde `.env.example` si no existe y conserva cualquier configuración local existente.

```bash
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm start:api
```

Ejecuta `pnpm start:worker` en otra terminal. Para desarrollo con recarga, usa un único `pnpm dev:build` y ejecuta `pnpm dev:api` y `pnpm dev:worker` por separado después de la primera compilación.

Para cambios de código, ejecuta `pnpm check`: formato, lint, compilación, tipos y pruebas unitarias/de contrato. Ejecuta también `pnpm test:integration` cuando el cambio afecte persistencia, migraciones, composición o ciclo de vida. Requiere PostgreSQL y `TEST_DATABASE_URL` apuntando a una base de pruebas separada.

Las pruebas de Nest cargan el código compilado mediante `test/helpers/compiled.ts`. Conserva este mecanismo para comprobar la metadata emitida y evitar duplicar tokens de inyección al mezclar loaders ESM y CommonJS. Verifica ambos entrypoints si modificas el arranque o las dependencias compartidas.

Escribe pruebas de comportamiento para los riesgos del cambio: aislamiento, autorización, idempotencia, carreras o recuperación de fallos. Para cambios solo documentales, basta comprobar el formato de los archivos afectados y sus referencias.

## Forma de trabajar

Revisa `git status` antes de editar y conserva los cambios existentes que no pertenezcan a la tarea. Mantén los cambios centrados en el encargo y evita refactorizaciones ajenas.

Escribe documentación y explicaciones en español; usa inglés para identificadores, rutas, campos, enums y códigos de error. Actualiza el README cuando cambien el arranque o los comandos, y los documentos de diseño cuando cambien contratos o decisiones.

Al entregar, explica qué cambió, qué comprobaste y qué sigue pendiente. Distingue entre diseño propuesto, comportamiento probado con simulaciones y capacidades verificadas en redes reales. Una prueba local no demuestra soporte live.
