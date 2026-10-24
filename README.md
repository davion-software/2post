# 2post

Infraestructura de publicación social para aplicaciones y agentes de IA mediante REST y MCP.

El backend tiene una base ejecutable de monolito modular, con API NestJS/Fastify y worker separados en un paquete TypeScript. Hay configuración validada, health checks, PostgreSQL y migraciones iniciales. Autenticación, publicaciones, jobs y MCP siguen pendientes. P0 y P1 no están completos.

## Preparar el entorno

Usa Node `24.18.1`, pnpm `10.34.5` y Docker con Compose en Linux, macOS o WSL. Las versiones están fijadas en `.nvmrc`, `.node-version` y `package.json`. Si usas nvm, activa el runtime con `nvm use`.

```bash
pnpm dev:setup
pnpm dev:doctor
pnpm dev
```

`dev:setup` instala las dependencias con el lockfile, crea `.env` si falta, inicia PostgreSQL local, asegura una base de pruebas separada y aplica las migraciones. Puedes repetirlo: conserva `.env`, los datos y las migraciones ya aplicadas. La preparación de bases acepta únicamente PostgreSQL local y rechaza `NODE_ENV=production`.

`dev:doctor` comprueba Node, pnpm, dependencias, configuración, Docker, puerto de API y conexión a ambas bases. Usa `pnpm dev:doctor --json` para obtener resultados estructurados. Si pnpm rechaza un runtime incorrecto antes de ejecutar scripts, usa `node scripts/doctor.mjs --json` y activa la versión indicada.

`dev` compila una vez y supervisa un único compilador TypeScript y los procesos de API y worker con recarga. Cada línea identifica el proceso. Ctrl+C cierra los grupos completos de procesos. PostgreSQL permanece disponible; `pnpm db:down` lo detiene y conserva el volumen.

La API escucha por defecto en `http://127.0.0.1:3000`:

- `GET /health/live` confirma que el proceso responde.
- `GET /health/ready` comprueba PostgreSQL y devuelve `503` si no está disponible. La versión del esquema se verifica por separado.

Para usar otro checkout en paralelo, asigna valores distintos de `COMPOSE_PROJECT_NAME`, `POSTGRES_PORT` y `PORT`, y ajusta ambas URLs de PostgreSQL en su `.env`. Cada proyecto de Compose conserva su propio volumen.

Para arrancar procesos sin recarga, usa `pnpm build`, `pnpm start:api` y `pnpm start:worker`. El worker mantiene una comprobación de PostgreSQL; todavía no consume jobs.

## Usar Vite+

`vite.config.ts` reúne la configuración de Oxlint, Oxfmt y Vitest. `vite-plus` está fijado mediante el catálogo de `pnpm-workspace.yaml`; ese archivo administra herramientas de un único paquete. No requiere instalar `vp` globalmente.

```bash
pnpm lint
pnpm format
pnpm test
pnpm test:integration
```

Oxlint comprueba también tipos y activa `typescript/no-floating-promises` y `typescript/no-misused-promises`. No admite ignorar una promesa con `void` sin gestionar su rechazo. Oxfmt conserva las convenciones de formato anteriores y excluye artefactos generados y documentos de producto existentes.

La compilación del backend sigue siendo `nest build`, para conservar la metadata de decoradores. Las pruebas cargan el código compilado mediante el loader nativo de Node, usando `test/helpers/compiled.ts`. Los proyectos Vitest se llaman `unit` e `integration`; `unit` incluye también las pruebas de contrato HTTP.

`pnpm exec vp check` ejecuta las comprobaciones estáticas de Vite+. Para el flujo completo del repositorio usa `pnpm check` o `pnpm verify`. El servidor de desarrollo del backend se inicia con `pnpm dev` o `pnpm exec vp run dev`.

VS Code puede instalar las extensiones recomendadas en `.vscode/extensions.json`. El repositorio configura Oxc como formateador y activa formato al guardar.

## Verificar cambios

```bash
pnpm check
pnpm verify
```

`check` compila, ejecuta Oxfmt y Oxlint tipado, comprueba tipos de herramientas y scripts, verifica arquitectura y ejecuta las pruebas unitarias y de contrato.

`verify` añade pruebas de los propios verificadores, integración con PostgreSQL, coherencia de migraciones y escaneo de secretos. Requiere el entorno preparado y Docker. CI ejecuta el mismo `dev:setup` y el mismo `verify`.

También puedes ejecutar cada comprobación:

- `pnpm architecture:check`: límites entre capas y módulos, cobertura de las zonas y ciclos de imports.
- `pnpm architecture:report`: informe completo de Fallow sobre código sin uso, duplicación y complejidad. Conserva las severidades predeterminadas y distingue informes de limpieza de los bloqueos de arquitectura.
- `pnpm tooling:check`: introduce fallos en directorios temporales y comprueba que Oxlint y Fallow los rechazan. Comprueba también una migración ausente, un contrato permitido y una relación entre schemas permitida.
- `pnpm db:check`: compara el esquema con una copia temporal de las migraciones. No escribe en `db/migrations` ni conecta a una base.
- `pnpm secrets:check`: Gitleaks con versión fijada en Docker, sobre archivos nuevos y versionados del árbol actual. Respeta `.gitignore`, rechaza archivos `.env` versionados y oculta los valores detectados. `pnpm verify` prueba además la detección con una credencial ficticia en un directorio temporal.

Las pruebas de integración usan `TEST_DATABASE_URL`. `dev:setup` crea esa base incluso si el volumen de Compose ya existía. Las pruebas de datos revierten sus transacciones. Las credenciales de `.env.example` y Compose son exclusivas del desarrollo local.

## Mantener los límites de los módulos

Cada funcionalidad conserva sus casos de uso, contratos y controladores dentro de `src/modules/<nombre>/`. Por ejemplo, `operations` contiene `application/check-readiness.ts`, `interfaces/health.controller.ts` y `operations.module.ts`. La infraestructura PostgreSQL y el puerto común `DatabaseProbe` permanecen compartidos.

Lee [la guía de arquitectura](docs/ARCHITECTURE.md) antes de añadir módulos. Fallow usa dos configuraciones complementarias:

- `.fallowrc.json` comprueba la dirección de dependencias entre capas. Un controlador no puede importar persistencia; dominio y aplicación no pueden importar adapters.
- `.fallow-modules.json` descubre los módulos y prohíbe acceder a sus archivos internos desde otro módulo. Admite contratos `*.contracts.ts` y relaciones entre archivos `*.schema.ts`.

Los mensajes sobre zonas de dominio o contratos vacías indican responsabilidades aún no implementadas. No requieren crear archivos vacíos. Una carpeta nueva de código fuente debe pertenecer a una zona; la comprobación falla si queda fuera.

## Cambiar el esquema

Edita los archivos `*.schema.ts`, ejecuta `pnpm db:generate`, revisa SQL y metadata, y aplica `pnpm db:migrate`. Crea migraciones nuevas para esquemas ya aplicados. La API y el worker no ejecutan migraciones durante el arranque.

La migración inicial crea `users` y `workspaces`, con email normalizado, estados restringidos, FK de ownership e índice. Las futuras escrituras deben actualizar `updated_at` y la versión. El bootstrap de operador y los permisos siguen pendientes.

## Trabajar con agentes

[AGENTS.md](AGENTS.md) indica las fuentes y comprobaciones por tarea. Las skills de Fallow están disponibles en `.agents/skills/`; necesitan las dependencias instaladas. `.codex/config.toml` registra el servidor MCP de Fallow para proyectos de confianza en Codex. El uso por CLI funciona sin activar ese servidor. La CI aplica las verificaciones con independencia del agente o editor.

El [mapa de arquitectura](docs/ARCHITECTURE.md) describe ownership y contratos. Las [decisiones](docs/adr/README.md) explican la composición del backend y la conservación del compilador de Nest junto a Vite+.

## Documentación del producto

- [PRD](docs/PRD.md)
- [TRD](docs/TRD.md)
- [Backend Schema](docs/BACKEND-SCHEMA.md)
- [Implementation Plan](docs/IMPLEMENTATION-PLAN.md)
- [Plan comercial](docs/COMMERCIAL-PLAN.md)
- [Índice y fuentes](docs/README.md)

El lanzamiento previsto usa cobro externo y activación manual. La producción prevista se aloja en AWS, región `us-east-1`.
