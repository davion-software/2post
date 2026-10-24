# Vite+ para herramientas y Nest para emitir el backend

Adoptamos Vite+ para Oxlint, Oxfmt y Vitest, conservando `nest build` y la salida CommonJS con resolución NodeNext. El backend usa metadata de decoradores para la inyección de Nest; las pruebas cargan el código compilado para comprobar el mismo mecanismo que ejecuta producción.

La configuración de herramientas vive en `vite.config.ts`. Oxlint añade comprobaciones asíncronas con información de tipos. El catálogo de pnpm fija Vite+ y conserva el alias de Vite generado por su migrador. Oxfmt sustituye el formato anterior con las mismas convenciones. La migración omitió dos reglas de sintaxis que ya rechaza el modo estricto: argumentos duplicados y literales octales antiguos.

El comando de desarrollo utiliza un solo compilador TypeScript en watch y recarga ambos entrypoints. Ese watch no borra `dist` al arrancar, para evitar que los procesos intenten cargar archivos mientras el compilador elimina el directorio. La compilación de entrega sigue siendo `nest build`.
