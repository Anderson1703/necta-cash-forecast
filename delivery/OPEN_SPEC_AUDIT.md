# Auditoría de consistencia — Necta Caja a 14 días

Fecha de revisión: 2026-10-15. Revisión sobre la implementación parcial local, no sobre una integración productiva.

## Verificaciones ejecutadas
- `npm test`: 36/36 aprobadas.
- `npm run typecheck`: bloqueado por ausencia local de `@types/node` (TS2688); **no** afirmar que pasó.
- Endpoint `GET /v2/stores/demo/cash-forecast?days=14`: contrato de demostración con fixture fija, sin autenticación ni MongoDB.

## Matriz requisito / implementación
| Requisito | Evidencia | Estado |
|---|---|---|
| Proyección diaria, tres escenarios | `src/domain/events.ts`, `forecast.ts`, tests | Implementado en demo |
| Trazabilidad de eventos e IDs duplicados | `events.ts`, tests | Implementado en demo; deduplicación semántica parcial |
| Cobros pendientes y comportamiento histórico | `events.ts`, fixture, tests | Implementado con heurísticas |
| Ventas confirmadas vs estimadas | `events.ts`, tests | Implementado con conciliación agregada diaria |
| Obligaciones y pagos vinculados | `events.ts`, tests | Implementado en dominio, no ledger |
| Saldo inicial y sensibilidad | `forecast.ts`, tests | Implementado en dominio; evidencia no autenticada |
| Calidad de datos y alertas | `quality.ts`, `alerts.ts`, tests | Implementado en dominio, sin entrega |
| Aislamiento por tienda y moneda | Solo especificación | **Pendiente**; endpoint demo sin auth |
| Sincronización offline, audio, BullMQ | Solo especificación | **Pendiente** |
| Concurrencia, auditoría y conflictos | Solo diseño | **Pendiente** |
| Notificaciones push/email/WhatsApp | Solo especificación | **Pendiente** |

## Desajustes / riesgos que no debemos ocultar
1. `specs/cash-forecast/spec.md` exige aislamiento por tienda; el endpoint demo no lo implementa. Se etiqueta expresamente como requisito de producción.
2. `specs/cash-alerts/spec.md` define entrega futura; `deriveAlerts` solo produce objetos, no envía notificaciones.
3. `specs/offline-sync/spec.md` es un contrato para construcción futura, no una implementación.
4. `tasks.md` contiene tareas de producto y demo; conviene separarlas visualmente y no marcar tareas productivas como realizadas.
5. El `README.md` y el diseño documentan fechas ilustrativas: 25 mayo–7 junio 2026, nueve tiendas agregadas y quincena 29–30. No afirmar que estas fechas se derivan íntegramente del anexo.
6. Los escenarios son heurísticos, no probabilidades calibradas; una alerta de cierre negativo no modela orden intradía.
7. `openingBalance.status='verified'` comprueba formato de fuente/evidencia, no autenticidad externa.
8. El endpoint devuelve error 404 fuera de su ruta fija y 400 para entradas inválidas; no tiene manejo productivo de autorización, observabilidad ni persistencia.
9. `npm run typecheck` no pudo completarse en este entorno sin instalar dependencias de desarrollo.

## Criterio de entrega
Presentar como **implementación parcial de backend + tests**, con OpenSpec del alcance de producto completo. Mostrar claramente qué es diseño futuro. Nunca describir esta demo como lista para producción.
