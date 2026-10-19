# Especificación: alertas de caja

## Requisitos añadidos

### Requisito: Advertencia temprana de déficit
El sistema DEBE identificar el primer día con saldo proyectado negativo en cada escenario y ofrecer una recomendación trazable.

#### Escenario: Riesgo de pago al proveedor
- **DADO** que Carmen tiene una obligación próxima con su proveedor.
- **CUANDO** la proyección conservadora cae por debajo de cero.
- **ENTONCES** se identifica la primera fecha de déficit.
- **Y** se recomienda confirmar cobros o negociar el vencimiento.

### Requisito: Canales de notificación (solo producción; no implementado)
El sistema productivo DEBE respetar preferencias y utilizar canales aprobados, con deduplicación y reintentos.

#### Escenario: Plantilla de WhatsApp no aprobada
- **DADO** que no existe plantilla proactiva aprobada.
- **CUANDO** se genera una alerta.
- **ENTONCES** no se envía WhatsApp mediante el endpoint de OTP.
- **Y** se considera un canal autorizado alternativo.

### Requisito: Evaluación explicable de calidad de datos (DEC-010)
El sistema DEBE informar la calidad de datos por separado del riesgo de liquidez mediante categorías deterministas y motivos trazables. NO DEBE presentar categorías heurísticas como probabilidades calibradas.

#### Escenario: Registros incompletos
- **DADO** que Carmen registra entre el 20 % y el 30 % de sus operaciones.
- **CUANDO** se genera la proyección a 14 días.
- **ENTONCES** la calidad es `low` con hallazgo `LOW_COVERAGE`.
- **Y** se recomienda mejorar el registro de operaciones.
- **Y** las alertas de liquidez siguen siendo específicas por escenario.

#### Escenario: Cobertura desconocida
- **DADO** que no se conoce un intervalo medido de cobertura.
- **CUANDO** se genera la proyección.
- **ENTONCES** se indica `COVERAGE_UNKNOWN`, sin suponer registros completos.

#### Escenario: Intervalo de cobertura inválido
- **DADO** que la cobertura está fuera de 0 a 1 o su mínimo supera su máximo.
- **CUANDO** se solicita la proyección.
- **ENTONCES** el dominio rechaza la entrada.

### Requisito: Alertas de dominio trazables (DEC-010)
El sistema DEBE generar identificadores, fechas, referencias de escenario y evidencias deterministas sin enviar notificaciones directamente.

#### Escenario: Caja diaria negativa
- **DADO** que un escenario presenta por primera vez un saldo de cierre diario negativo.
- **CUANDO** se derivan las alertas.
- **ENTONCES** se genera `CASH_SHORTFALL` con escenario, fecha y evidencia.
- **Y** la alerta NO DEBE afirmar que un saldo de cierre demuestra capacidad de pago intradía.

#### Escenario: Sin plantilla empresarial de WhatsApp aprobada
- **DADO** que se genera una alerta de dominio.
- **CUANDO** la entrega no está implementada o aprobada.
- **ENTONCES** el motor no envía WhatsApp, push ni correo.
