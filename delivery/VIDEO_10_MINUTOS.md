# Guion de video técnico — máximo 10 minutos

**Importante:** personaliza el tiempo real invertido y los ejemplos de IA. No declares como propios hechos que no ocurrieron. Duración objetivo: 9:15, margen 45 segundos.

## 0:00–0:45 — Contexto y problema
«Hola. Para esta prueba diseñé Caja a 14 días, una proyección de liquidez para una microempresaria que registra solo parte de sus operaciones. El objetivo no es prometer cuánto dinero tendrá, sino mostrar posibles tensiones de caja, la calidad de la información y qué acciones conviene tomar.»
Mostrar `proposal.md`.

## 0:45–2:00 — Arquitectura y decisiones
«Elegí un motor de eventos diarios en TypeScript, separado de HTTP y persistencia. Cada evento tiene fecha, importe, dirección y origen. El saldo se calcula acumulativamente para tres escenarios heurísticos. No uso un LLM para la aritmética: necesito cálculos reproducibles y auditables.»
Mostrar `design.md`, `src/domain/events.ts`, `forecast.ts`.

## 2:00–3:10 — Dato incompleto y saldo inicial
«Hay dos referencias de saldo, COP 1.900.000 y COP 1.640.000. Seleccioné la reconstruida de manera provisional y expongo la discrepancia de COP 260.000. La calidad de datos se reporta separadamente del riesgo de liquidez. No confundo un saldo de cierre positivo con la capacidad de pagar a una hora específica.»
Mostrar `quality.ts` y `balanceAssessment`.

## 3:10–4:20 — Evitar doble contabilización
«Las ventas confirmadas sustituyen parcialmente las estimadas del mismo día, si no están ya incluidas en el saldo inicial. Para obligaciones recurrentes, vinculo cada pago a una obligación estable. Un abono de COP 500.000 al alquiler de COP 1.300.000 deja COP 800.000 pendientes; nunca descuento dos veces la misma deuda.»
Mostrar `events.ts` y tests relevantes.

## 4:20–6:20 — Demo en vivo
Iniciar `npm start`, ejecutar `curl`, mostrar `DEMO_ENDPOINT.md`.
«La API de demostración devuelve 14 días y tres escenarios. El conservador cae bajo cero el 29 de mayo. El base presenta su primer déficit el 1 de junio, aunque termina el horizonte positivo. El optimista no presenta déficit. Son supuestos transparentes, no probabilidades calibradas.»
Mostrar `alerts`, `recommendations`, `dataQuality` y eventos del viernes.

## 6:20–7:10 — Pruebas
«El proyecto tiene 36 pruebas automatizadas aprobadas. Incluyen continuidad diaria, pagos parciales, deduplicación, saldo inicial, cobertura de datos y alertas. La comprobación `tsc` requiere instalar dependencias de desarrollo; no voy a afirmar que se verificó si no la he ejecutado exitosamente.»
Mostrar `npm test`.

## 7:10–8:10 — Qué falta y tradeoffs
«Esto es una implementación parcial: el endpoint está conectado a una fixture y no tiene autenticación ni MongoDB. OpenSpec especifica autorización por tienda, sincronización offline, control de versiones, procesamiento asíncrono y notificaciones, pero no están construidos. Elegí no añadir infraestructura que no podía probar dentro del alcance.»
Mostrar `tasks.md` y auditoría.

## 8:10–8:45 — Cambio de opinión
Ejemplo válido solo si refleja tu proceso real: «Al principio pensé en sumar ventas confirmadas y estimadas. Lo cambié al detectar doble contabilización; ahora el confirmado sustituye parte de la estimación. También pasé de tratar el saldo inicial como un número a exigir procedencia y conciliación.»

## 8:45–9:15 — IA, tiempo y próximos pasos
«Usé IA como apoyo para [indica uso real: diseño, revisión, tests]. Un prompt real fue: [inserta el texto exacto]. Otro fue: [inserta el texto exacto]. Corregí la sugerencia de [describir sugerencia concreta y corrección comprobable]. El tiempo real que dediqué fue [indicar tiempo]. Lo siguiente sería integrar MongoDB y permisos por tienda, después conciliación real, observabilidad y pruebas de extremo a extremo.»

## Antes de grabar
- Sustituir los marcadores de tiempo y prompts con datos verdaderos.
- Ensayar y comprobar que dure menos de 10 minutos.
- No presentar como implementadas las integraciones especificadas solamente.
- Tener `npm start` levantado y la terminal de demo lista.
