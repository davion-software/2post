# 2post: oferta y presupuesto de lanzamiento

Versión: 0.1. Fecha: 2026-10-21. Estado: oferta inicial aprobada para el diseño; sin ventas, compras de créditos ni infraestructura ejecutadas en esta tarea.

Este documento fija los valores comerciales de [PRD COST y COM](PRD.md#124-costos-de-proveedor-cost). El [TRD](TRD.md#85-acceso-comercial-cuotas-y-prepago) define la aplicación técnica. Los precios de 2post son decisiones propias, no precios del proveedor ni rentabilidad validada.

## 1. Presupuesto de X

- Compra inicial: USD 50 de créditos de X, sin recarga automática.
- Tope de gasto de la consola: USD 100 por ciclo de facturación del proveedor.
- Tope interno: USD 90 por ese mismo ciclo, con alertas a USD 45, 72 y 90.
- Límite efectivo de envío: el menor entre presupuesto restante y saldo real financiado disponible, descontando reservas. Un saldo inicial de USD 50 no permite gastar USD 90.
- Conciliación diaria durante el piloto entre estimaciones de 2post y consumo de consola. Ante una diferencia que invalide el saldo o el tope, detener nuevos dispatch de X hasta corregirla.

La [tabla oficial de X](https://docs.x.com/x-api/getting-started/pricing), consultada el 2026-10-21, lista USD 0,015 por create sin URL y USD 0,200 con URL. También lista cobros por lecturas y otras operaciones. Los precios y la categoría real de cada operación se verifican con la app del piloto; no se presupone que media, polling y errores sean gratuitos.

X anuncia USD 20 promocionales para la primera tarjeta elegible y compra de créditos. Si la app cumple las condiciones y la consola los acredita, USD 50 comprados podrían dar USD 70 disponibles. El presupuesto base usa solo los USD 50 pagados. El incentivo de primera recarga automática y los créditos de xAI no cuentan como financiación del piloto. Ver [incentivos oficiales](https://docs.x.com/x-api/getting-started/free-credits).

Como referencia, USD 50 alcanzan para 3.333 creates sin URL o 250 con URL, antes de cualquier operación auxiliar. USD 90 cubrirían 6.000 o 450, respectivamente, si ese saldo estuviera financiado. Con 10 workspaces, 50 publicaciones por workspace y 50 % con URL, el costo de creates sería USD 53,75. Haría falta financiar más que la compra inicial de USD 50.

Estos importes cubren consumo de X. AWS, dominio, correo, procesador de pagos y operación tienen presupuesto separado. No representan el costo total de operar 2post.

## 2. Planes desde el lanzamiento

Los importes están en USD por workspace. Las tarifas iniciales se revisan con uso real antes de ampliar el acceso.

| Plan | Precio mensual | Cuentas live activas | Publications live incluidas en LinkedIn y Bluesky | X live |
|---|---|---|---|---|
| Sandbox | Gratis | 2 | 30 compartidas por mes UTC | 0 |
| Builder | 9 | 5 | 300 compartidas por mes UTC | Prepago adicional |
| Pro | 29 | 25 | 2.000 compartidas por mes UTC | Prepago adicional |

REST y MCP están disponibles en todos los planes. Una cuenta de X también ocupa una plaza del límite de cuentas del plan. Sandbox no permite conectar X live. Cada red se ofrece únicamente cuando ha superado su puerta de integración; cobrar un plan no habilita capacidades sin verificar.

`test` es gratuito y no tiene cuota comercial mensual; siguen vigentes rate limits, límites de almacenamiento y controles de abuso. Usa cuentas simuladas y nunca publica en redes reales.

La unidad incluida es una Publication hacia una cuenta. Un Post enviado a dos cuentas de LinkedIn consume dos unidades. Un destino X usa su cuota y saldo separados. La reserva se hace en el mes UTC de aceptación, incluso si se programa para otro mes. Un retry automático no consume otra unidad incluida. Cancelar, vencer o fallar antes del dispatch devuelve la reserva al mes original. Tras el dispatch, el intento usa una unidad aunque termine fallido; esa unidad representa procesamiento de publicación, no una garantía de éxito upstream.

El período pagado se registra con fechas explícitas de inicio y final. Las cuotas incluidas usan meses UTC; activar o cambiar plan no las reinicia ni acumula cupos automáticamente. El primer período parcial recibe el límite completo de ese mes. No hay rollover. Al vencer el acceso pagado se conserva lectura e historial y se completan trabajos ya aceptados; no se aceptan nuevas operaciones de pago. Downgrades y cambios los aplica el operador con límites nuevos y el consumo ya registrado.

## 3. X se cobra aparte

Tarifa inicial de 2post por Publication confirmada, separada de la suscripción:

- Sin URL: USD 0,02.
- Con URL: USD 0,25.
- Cuota inicial de seguridad: 50 Publications de X por workspace y mes UTC, configurable por el operador tras revisar saldo, uso y presupuesto global.

El cliente paga por adelantado mediante el medio externo acordado y el operador acredita el saldo después de verificarlo. El saldo interno de 2post no es un crédito de X ni se transfiere a la consola de X. No hay sobreconsumo ni cargo posterior automático. Las condiciones de devolución y el tratamiento de impuestos y comisiones deben figurar en la oferta al cliente antes del primer cobro.

Se muestra la tarifa y se reserva saldo al aceptar. Confirmar `published` convierte la reserva en cargo. Un fallo definitivo sin publicación confirmada libera el saldo; un `unknown` lo mantiene reservado hasta resolución. Un retry automático no cobra otra vez. Un retry manual tras fallo definitivo vuelve a reservar. El retry reconocido desde `unknown` reserva una nueva generación; ambas generaciones pueden cobrarse si ambas publicaciones se confirman, y se informa antes de autorizarlo. El coste upstream de intentos fallidos y automáticos lo asume 2post.

La diferencia nominal entre tarifa y costo de create es USD 0,005 sin URL y USD 0,05 con URL: 25 % y 20 % de la tarifa, respectivamente. No es margen neto: faltan lecturas, media, intentos fallidos, comisiones, infraestructura y soporte. Si la medición real consume esa diferencia, ajustar la tarifa para operaciones nuevas; no modificar retroactivamente las ya aceptadas.

## 4. Piloto y cobro manual

El piloto puede incorporar de 3 a 5 design partners con concesión gratuita de duración explícita y hasta 50 Publications de X por workspace durante el piloto. El operador registra la concesión y su presupuesto. Es una excepción acotada; el plan gratuito público mantiene 0 X live.

Para lanzar de pago no hace falta un dashboard ni un motor de suscripciones. El operador verifica un pago externo, registra su referencia única, activa Builder o Pro con vigencia y límites y acredita el prepago X adquirido. Repetir una referencia no duplica derechos ni saldo. Un comando de operador autenticado ejecuta esos cambios y conserva auditoría; una API key de cliente nunca puede autoactivarse.

Antes de lanzar se verifica el ciclo de activación, recarga, expiración, cancelación, devolución o ajuste y recuperación tras error. Un pago no confirmado no habilita acceso. El procesador concreto se elige durante preparación comercial; esta tarea no crea cuentas de cobro ni envía enlaces a clientes.

## 5. Automatización posterior

Registro público, login humano, checkout integrado, suscripciones, renovaciones y facturación automatizada forman una entrega posterior. Esa entrega conserva Workspace como unidad comercial y reutiliza el registro idempotente de derechos y saldo. La asistencia IA y sus costos se especifican por separado.
