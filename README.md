# 2post

Infraestructura de publicación social para aplicaciones y agentes de IA mediante API REST y MCP.

El backend tiene una base ejecutable de monolito modular: un paquete TypeScript, API NestJS/Fastify y worker como procesos separados, configuración validada, PostgreSQL y migraciones Drizzle. Los casos de negocio, autenticación, jobs, REST de producto, MCP e integraciones sociales siguen pendientes. Esta base no completa P0 ni P1.

El lanzamiento previsto ofrece acceso de pago con cobro externo y activación manual. La producción prevista se aloja en AWS, región `us-east-1`.

## Desarrollo local

Requisitos: Node.js `24.18.1`, pnpm `10.34.5` y Docker con Compose. Las versiones de Node están fijadas en `.nvmrc` y `.node-version`; las dependencias se conservan en `pnpm-lock.yaml`.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm start:api
```

En otra terminal:

```bash
pnpm start:worker
```

La API escucha por defecto en `http://127.0.0.1:3000`:

- `GET /health/live`: confirma que el proceso responde.
- `GET /health/ready`: comprueba PostgreSQL; devuelve `503` si no está disponible. No verifica todavía la versión del esquema.

El worker comprueba PostgreSQL al arrancar, mantiene una comprobación periódica y libera conexiones al recibir `SIGINT` o `SIGTERM`. Todavía no consume jobs. Las migraciones se ejecutan como un paso explícito, separado de API y worker.

Para recompilar durante el desarrollo, ejecutar `pnpm dev:build` y, en terminales separadas, `pnpm dev:api` y `pnpm dev:worker`. Ejecutar primero `pnpm build` para crear los entrypoints. Un único compilador actualiza ambos procesos y conserva la metadata de decoradores de Nest.

`pnpm db:down` detiene PostgreSQL y conserva el volumen. Las credenciales de Compose y `.env.example` son exclusivas del entorno local.

## Estructura y límites

```text
src/
  entrypoints/          # API, worker y ejecución de migraciones
  bootstrap/            # Composición y ciclo de vida de cada proceso
  application/          # Casos de uso y puertos sin dependencias de framework
  modules/
    identity/           # Esquema inicial de users
    workspaces/         # Esquema inicial y ownership
    operations/         # Composición de los health checks
  adapters/postgres/    # Pool, Drizzle y migraciones
  interfaces/rest/      # Controladores HTTP
  config/              # Configuración validada e inyección compartida
  observability/       # Logs JSON y correlación de solicitudes
db/migrations/         # SQL versionado y snapshots de Drizzle
test/                  # Pruebas unitarias, contratos e integración
```

Los módulos se incorporan con sus primeras responsabilidades. El resto de módulos de negocio se describe en el TRD. El dominio y los casos de uso no importan Nest, ORM ni SDKs; ESLint comprueba este límite. Los controladores se conectan a casos de uso y estos reciben puertos que implementan los adapters.

La primera migración crea `users` y `workspaces`, con email normalizado único, estados restringidos, ownership por FK e índice, fechas y versión de workspace positiva. No crea cuentas de usuario ni publica operaciones de administración. El bootstrap de operador y los permisos pertenecen a la siguiente entrega. Las futuras escrituras deberán actualizar `updated_at` y la versión según el contrato; esta base no incluye operaciones de escritura.

## Verificación

```bash
pnpm check
pnpm test:integration
```

`pnpm check` ejecuta formato, lint, tipos, compilación y pruebas unitarias/de contrato. Estas pruebas cargan los archivos de `dist`, compilados por TypeScript con metadata de Nest. Las pruebas de integración necesitan `TEST_DATABASE_URL`, aplican las migraciones en esa base y prueban restricciones, readiness real y arranque/cierre de ambos procesos. El comando de integración recompila primero y carga `.env` cuando existe; las variables exportadas tienen prioridad.

Compose crea `two_post_test` al inicializar un volumen nuevo. Si el volumen ya existía, crear esa base de pruebas una vez antes de ejecutar la integración. Las pruebas de datos usan transacciones con rollback. La CI reproduce ambas suites contra PostgreSQL.

Para cambiar el esquema, editar los archivos `*.schema.ts`, ejecutar `pnpm db:generate`, revisar el SQL generado y aplicar `pnpm db:migrate`. No modificar una migración ya aplicada. Ejecutar comandos desde la raíz del repositorio. En producción, las migraciones necesitan credenciales y permisos propios; la API y el worker no deben usar el rol de migración.

## Documentación del producto

- [PRD](docs/PRD.md)
- [TRD](docs/TRD.md)
- [Backend Schema](docs/BACKEND-SCHEMA.md)
- [Implementation Plan](docs/IMPLEMENTATION-PLAN.md)
- [Plan comercial](docs/COMMERCIAL-PLAN.md)
- [Índice y fuentes](docs/README.md)
