# Mantener los límites del backend

2post tiene un paquete TypeScript con procesos de API y worker. Ambos comparten reglas y persistencia. REST y MCP son entradas a los mismos casos de uso; MCP sigue pendiente de implementación.

## Ubicar una funcionalidad

Coloca cada funcionalidad en `src/modules/<nombre>/`. Incorpora únicamente las capas que tengan código:

- `domain/` contiene reglas y estados de negocio independientes de infraestructura.
- `application/` contiene casos de uso y los puertos que necesitan.
- `interfaces/` convierte solicitudes REST o MCP en llamadas a casos de uso.
- `adapters/` implementa los puertos específicos de esa funcionalidad.
- `<nombre>.contracts.ts` publica los tipos y puertos que pueden consumir otros módulos.
- `<nombre>.module.ts` compone providers de Nest con los casos de uso del módulo.

`operations` es el ejemplo existente: su controlador y `CheckReadiness` están dentro del módulo. Identidad y workspaces tienen por ahora schemas, sin operaciones de negocio. Crea sus contratos cuando exista un consumidor real.

## Compartir infraestructura

El pool PostgreSQL, migraciones y futuros jobs o almacenamiento común viven en `src/adapters/`. Configuración y logs viven en `src/config/` y `src/observability/`. `src/application/ports/database-probe.ts` contiene el puerto compartido de disponibilidad.

`src/bootstrap/`, `src/entrypoints/` y los módulos raíz hacen la composición entre funcionalidades e infraestructura. Los contratos de negocio no publican tipos del ORM, Nest ni SDKs externos.

Una relación FK entre archivos `*.schema.ts` puede referenciar el schema de otro módulo. Esa excepción no permite que un caso de uso o controlador acceda al schema directamente. El código de negocio de un módulo consume contratos de otros módulos; la composición raíz conecta las implementaciones.

## Comprobar la dirección de dependencias

Ejecuta `pnpm architecture:check`. El comando aplica dos análisis de Fallow sobre el mismo código:

1. `.fallowrc.json` define las capas y sus dependencias permitidas. Prohíbe imports desde controladores a persistencia y desde aplicación o dominio a adapters. Exige clasificar los archivos fuente y detecta ciclos.
2. `.fallow-modules.json` descubre los hijos de `src/modules/` como zonas separadas. Prohíbe imports entre sus archivos internos. Distingue contratos, schemas e infraestructura compartida.

Las restricciones sobre paquetes externos, como Nest y Drizzle dentro de aplicación, se comprueban también con Oxlint. Incluye las futuras carpetas de dominio y los contratos al ampliar la configuración.

Para inspeccionar la asignación real de zonas, ejecuta:

```bash
pnpm exec fallow list --boundaries
pnpm exec fallow --config .fallow-modules.json list --boundaries
```

`pnpm tooling:check` prueba violaciones de capas, imports internos entre módulos, ciclos y archivos sin clasificar. También verifica que los contratos y las relaciones entre schemas sigan permitidos. Las pruebas trabajan en directorios temporales.

Fallow conserva sus severidades predeterminadas. El análisis semántico adicional de Fallow permanece desactivado; Oxlint tipado y TypeScript ya comprueban tipos. Los informes de duplicación y complejidad se consultan con `pnpm architecture:report`. Revisa cada hallazgo antes de eliminar código que Nest pueda utilizar por reflexión.
