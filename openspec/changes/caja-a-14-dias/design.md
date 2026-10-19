# Diseño técnico: Caja a 14 días

## DEC-001: Captura de voz sin conexión
Guardar el audio en almacenamiento privado y duradero de la aplicación, junto con un registro en una bandeja de salida SQLite. El audio no constituye una venta contabilizada. Sincronizar al recuperar conexión y al abrir la aplicación; la sincronización en segundo plano es de mejor esfuerzo. La IA genera un borrador que requiere confirmación humana antes de registrar una venta.

## DEC-002: Procesamiento asíncrono
La API Node.js autentica y autoriza el acceso a la tienda, almacena el audio de manera duradera y registra atómicamente en MongoDB una solicitud persistente de procesamiento. Un despachador recupera solicitudes pendientes y las envía a BullMQ/Redis. Los trabajadores reintentan fallos transitorios con espera exponencial y variación aleatoria, y registran borrador y estado. Evitar solicitudes duplicadas mediante una clave estable de carga y ventas duplicadas mediante `clientMutationId`. Un trabajo puede ejecutarse más de una vez: sus efectos deben ser idempotentes. No prometer entrega de red «exactamente una vez». No reutilizar el endpoint de OTP por WhatsApp para alertas proactivas.

## DEC-003: Concurrencia optimista
Asignar una versión a cada registro editable. La actualización atómica en MongoDB debe coincidir en `_id`, `storeId` y `version`, e incrementar la versión. Una edición obsoleta devuelve `409 VERSION_CONFLICT` y permanece pendiente para revisión explícita. La resolución comprueba nuevamente la versión y las reglas de negocio; las correcciones financieras podrían requerir asientos compensatorios. Registrar auditoría con actor y hora del servidor de forma atómica con el cambio autorizado.

## DEC-004: Autorización
Aplicar RBAC por tienda para propietario, administrador y operador. El backend verifica permisos y pertenencia a la tienda para cada operación y recurso. No confiar en roles ni identificadores de tienda enviados por el cliente. No combinar datos entre tiendas por defecto ni exponer datos de otros negocios sin autorización.

## DEC-005: Escenarios de caja
Una función pura proyecta entradas y salidas durante 14 días a partir de un saldo inicial provisional. Señalar diferencias de saldo y baja cobertura de registros. Los escenarios son supuestos heurísticos, no probabilidades calibradas. No contabilizar una venta a crédito como efectivo antes del cobro; usar el importe pendiente. Conciliar obligaciones recurrentes con pagos registrados para evitar duplicación.

## DEC-006: Motor de eventos diarios
Generar eventos fechados para ventas de contado, cobros, gastos recurrentes y obligaciones confirmadas. Agrupar por día y trasladar el saldo de cierre al día siguiente. Mostrar primer déficit, saldo mínimo, explicaciones y acciones basadas en reglas. Mantener el dominio independiente de HTTP y persistencia. Para este caso, todos los importes se representan mediante enteros en COP.

## Supuestos y limitaciones explícitos
- El anexo no indica vencimientos exactos para las nueve tiendas restantes: la demostración las agrupa en el último día del horizonte como supuesto ilustrativo.
- El incremento de ventas por quincena no tiene fechas exactas: la demostración configura solo el 29 y 30 de mayo.
- Se supone gasto operativo de lunes a sábado y cierre los domingos.
- La cuota del préstamo del día 10 queda fuera del horizonte del 25 de mayo al 7 de junio.
- En el escenario base, un cobro vencido con historial deficiente no se considera automáticamente disponible; no significa que sea incobrable.
- Las ventas estimadas son el total esperado del día, no una suma adicional a cobros ya contabilizados.
- El endpoint HTTP usa datos ficticios fijos, no tiene autenticación y no debe exponerse como servicio productivo.

## Alternativas descartadas
- LLM para aritmética financiera: insuficiente determinismo y auditabilidad.
- Modelo de aprendizaje automático de pagos con historial escaso: falsa precisión.
- Última escritura gana: descartaría silenciosamente cambios financieros.
- Microservicios completos para el ejercicio: complejidad injustificada.

## Integración y gestión de fallos
Producción requiere adaptadores MongoDB, autorización por tienda, almacenamiento cifrado de audio, trabajadores BullMQ, planificador de alertas, confirmaciones de Expo Push, correo y plantillas de WhatsApp aprobadas por separado. Ante datos incompletos, mostrar menor calidad de información en vez de inventar certeza. En conflictos offline, conservar ambas versiones. Ante fallos del trabajador, recuperar solicitudes del almacenamiento duradero.

## Costos y escalabilidad
El cálculo determinista no consume créditos de IA y puede almacenarse temporalmente por tienda y versión de datos. Recalcular tras cambios relevantes y periódicamente; limitar la concurrencia. La extracción por IA puede consumir créditos, pero los reintentos no deben cobrar dos veces.

## Entrega y pruebas
La demostración utiliza Node.js 22, ejecución de TypeScript y el ejecutor de pruebas integrado, sin dependencias de ejecución adicionales. El despliegue productivo queda abierto. Probar límites de fechas, duplicados, pagos parciales y continuidad diaria.

## DEC-007: Sustitución parcial de ventas estimadas
Por cada fecha y escenario, sumar las ventas de contado confirmadas **no incluidas** en el saldo inicial. La estimación residual es `max(0, scenarioDailySalesEstimate - confirmedCashSales)`. Mantener los eventos confirmados individualmente para trazabilidad. Si las ventas confirmadas superan la estimación, conservarlas todas y no generar residual.

La regla solo aplica a ventas de contado del mismo día y flujo; ventas a crédito, cobros de cuentas pendientes, devoluciones y otras entradas se clasifican aparte. Rechazar eventos confirmados cuya inclusión en el saldo inicial sea desconocida o positiva. La capa de ingestión debe determinar el corte antes de marcar un evento como futuro.

**Límite:** conciliación agregada por día, no correspondencia transacción por transacción. La conciliación de obligaciones vinculadas se aborda en DEC-008; en producción se requieren referencias contables estables.

## DEC-008: Obligaciones y pagos vinculados
Cada obligación tiene ID estable, `recurrenceId` y `periodKey` opcionales e importe total. Los pagos se asocian mediante `obligationId`, nunca por coincidencia de fecha o importe. `paidBeforeCutoff` representa pagos incluidos en el saldo inicial; `obligationPayments` representa salidas confirmadas posteriores al corte. Se proyectan pagos futuros en su fecha más el saldo `max(0, faceAmount - paidBeforeCutoff - futureLinkedPayments)` al vencimiento, o al inicio si está vencido. Rechazar sobrepagos, obligaciones desconocidas, IDs repetidos, períodos recurrentes duplicados y cortes ambiguos.

Esto es conciliación de proyección, **no un libro mayor contable**. Un adaptador productivo debe calcular pagos anteriores desde movimientos autorizados, verificar tienda y permisos, evitar que un mismo débito aparezca también en `confirmedFutureEvents` y conservar auditoría. Los pagos ya incluidos en el saldo inicial no vuelven a descontarse. Un excedente requiere política explícita de anticipo.

La demostración rechaza pagos futuros posteriores al vencimiento de su obligación para evitar subestimar la necesidad de caja en la fecha exigible. Producción podría admitirlos mediante un plan aprobado de reprogramación.

## DEC-009: Saldo inicial explícito y análisis de sensibilidad
- Usar por defecto COP 1.640.000 reconstruidos como saldo **provisional**, no verificado.
- Conservar COP 1.900.000 guardados y la diferencia de COP 260.000 para revisión.
- Admitir saldo verificado solo con fuente confiable (`bank_verified` o `cash_count`) y referencia de evidencia. La autenticidad se comprueba antes de llamar al motor; el motor solo valida estructura.
- Exigir un corte coherente entre saldo inicial y eventos futuros.
- Mostrar sensibilidad por escenario entre saldos guardado y reconstruido, sin interpretarla como probabilidad ni intervalo estadístico.
- No promediar saldos ni modificar cobros u obligaciones al cambiar la referencia inicial.
- El caso demostrativo no dispone de extracto bancario verificado; las verificaciones son hipotéticas en las pruebas.

## DEC-010: Calidad de datos y alertas
Separar `assessDataQuality()` de `deriveAlerts()` y `deriveRecommendations()`. La calidad se clasifica mediante reglas (`low`, `medium`, `high`) con motivos explícitos, no como probabilidad estadística. Cobertura menor del 50 % según su límite superior, o cobertura desconocida, produce hallazgo de alta severidad. Saldo provisional, discrepancia, historial de pagos ausente y obligaciones inferidas producen hallazgos de severidad media. Un saldo diario negativo genera alerta de déficit independientemente de la calidad. Las alertas del dominio tienen IDs estables y evidencia, pero no envían mensajes. Un planificador futuro debe respetar preferencias, aprobación de canales, deduplicación, idempotencia y límites de frecuencia. Los umbrales son supuestos de política que deben calibrarse antes de producción.
