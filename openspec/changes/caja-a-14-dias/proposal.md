# Propuesta de cambio: Caja a 14 días

## Problema
Las personas que administran pequeños negocios con Necta necesitan saber si su caja cubrirá las obligaciones próximas. En el caso de Carmen Ortiz, solo se registra entre el 20 % y el 30 % de las operaciones, los saldos difieren en COP 260.000 y faltan obligaciones recurrentes. Considerar las cuentas por cobrar como dinero garantizado sería engañoso.

## Objetivo
Ofrecer una proyección diaria de caja a 14 días, transparente y explicable, con escenarios conservador, base y optimista, advertencias visibles sobre calidad de datos y recomendaciones accionables. Preservar la integridad financiera en los flujos móviles sin conexión y en la web.

## Alcance de la implementación parcial
- Motor puro en TypeScript basado en eventos diarios y endpoint HTTP de demostración.
- Fechas de cobro estimadas por escenario y ventas de contado proyectadas.
- Obligaciones conocidas y supuestas, advertencia de conciliación y detección de déficits.
- Recomendaciones basadas en reglas y pruebas automatizadas.
- Especificaciones de diseño para captura de voz sin conexión, sincronización, autorización, resolución de conflictos y notificaciones.

## Fuera del alcance de la implementación parcial
- Integración real con MongoDB y autenticación de producción.
- BullMQ, Redis, almacenamiento duradero de audio, llamadas a IA de voz e interfaz móvil.
- Envío real de notificaciones push, correo o WhatsApp.
- Entrenamiento de modelos, probabilidades calibradas y despliegue productivo.

## Criterios de éxito
- Saldos diarios reproducibles durante 14 días para tres escenarios.
- Trazabilidad explícita de cada evento de la proyección.
- Rechazo de identificadores de evento duplicados y conciliación de flujos vinculados.
- Pruebas automatizadas con datos del caso de Carmen derivados del anexo.
- Comunicación clara de supuestos e información incompleta.
