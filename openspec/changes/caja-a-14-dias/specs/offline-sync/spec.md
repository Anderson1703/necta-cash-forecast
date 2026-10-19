# Especificación: sincronización sin conexión

> **Solo contrato de producción.** Esta demostración parcial de backend no implementa sincronización móvil sin conexión, captura duradera de audio ni trabajadores.

## Requisitos añadidos

### Requisito: Persistencia antes de confirmar el guardado
La aplicación móvil DEBE almacenar de forma duradera la grabación y su registro en la bandeja SQLite antes de indicar que se guardó.

#### Escenario: Captura sin conexión
- **DADO** que Carmen graba audio sin conexión.
- **CUANDO** reinicia la aplicación.
- **ENTONCES** la grabación continúa disponible localmente.
- **Y** se muestra como pendiente, no como venta registrada.

### Requisito: Carga y registro idempotentes
El backend DEBE reconocer cargas repetidas con la misma clave estable y DEBE utilizar `clientMutationId` al registrar ventas confirmadas.

#### Escenario: Respuesta de red perdida
- **DADO** que el servidor aceptó una carga.
- **CUANDO** la aplicación reintenta tras agotar el tiempo de espera.
- **ENTONCES** recibe la solicitud de procesamiento existente.
- **Y** no se crea otra solicitud lógica ni una venta duplicada.

### Requisito: Revisión de conflictos
El sistema DEBE conservar una edición sin conexión obsoleta y devolver un conflicto, sin sobrescribir silenciosamente el registro del servidor.

#### Escenario: Edición simultánea desde la web
- **DADO** que la edición móvil parte de la versión 3 y el servidor está en la versión 4.
- **CUANDO** se sincroniza la edición móvil.
- **ENTONCES** el backend devuelve `409 VERSION_CONFLICT`.
- **Y** conserva el registro del servidor.
- **Y** la edición móvil permanece pendiente de revisión.

### Requisito: Resolución autorizada y auditada
Solo usuarios con permiso por tienda DEBEN resolver conflictos. La resolución DEBE validar nuevamente la versión y registrar auditoría.

#### Escenario: La versión cambia durante la revisión
- **DADO** que el usuario revisa la versión 4.
- **CUANDO** el servidor avanza a la versión 5 antes de resolver.
- **ENTONCES** se rechaza la resolución obsoleta.
- **Y** se muestran los valores más recientes.
