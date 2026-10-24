# Un paquete con módulos y procesos separados

2post comparte reglas, permisos e idempotencia entre REST y MCP, mientras el worker necesita un ciclo de ejecución independiente. Conservamos un paquete y dos procesos para compartir esos casos de uso y desplegar API y worker por separado.

Las funcionalidades agrupan sus capas en `src/modules/<nombre>/` y se comunican mediante contratos. La infraestructura común permanece fuera de los módulos. Fallow verifica tanto la dirección de las capas como el aislamiento entre módulos; las relaciones FK entre schemas son una excepción explícita. La composición raíz conecta las implementaciones a sus puertos.
