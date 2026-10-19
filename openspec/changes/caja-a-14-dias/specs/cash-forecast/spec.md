# Especificación: proyección de caja

## Requisitos añadidos

### Requisito: Proyección diaria de 14 días
El sistema DEBE calcular saldos diarios para los escenarios conservador, base y optimista a partir de un saldo inicial explícito y provisional.

#### Escenario: Continuidad diaria
- **DADO** que se solicita un horizonte de 14 días.
- **CUANDO** se calcula la proyección.
- **ENTONCES** el saldo inicial de cada día coincide con el cierre del día anterior.
- **Y** cada cierre es igual al saldo inicial más entradas menos salidas.

### Requisito: Eventos financieros trazables
El sistema DEBE incluir eventos fechados e identificables y DEBE impedir IDs duplicados dentro de una proyección.

#### Escenario: Obligación con proveedor
- **DADO** que existe un pago al proveedor de COP 4.200.000 con vencimiento el 29 de mayo.
- **CUANDO** se calcula la proyección.
- **ENTONCES** aparece una sola vez el 29 de mayo en cada escenario.

### Requisito: Incertidumbre transparente
El sistema DEBE señalar diferencias de saldo y cobertura incompleta y NO DEBE presentar escenarios heurísticos como probabilidades calibradas.

#### Escenario: Diferencia de saldos de Carmen
- **DADO** un saldo guardado de COP 1.900.000 y uno reconstruido de COP 1.640.000.
- **CUANDO** se genera la proyección.
- **ENTONCES** se informa una diferencia de COP 260.000.
- **Y** el saldo inicial se identifica como provisional.

### Requisito: Importes pendientes de cobro
El sistema DEBE utilizar el importe pendiente, no el total original de la factura.

#### Escenario: Cobro parcial
- **DADO** que una cuenta por cobrar ya recibió un abono contabilizado.
- **CUANDO** se proyectan cobros futuros.
- **ENTONCES** solo se incluye el importe pendiente.

### Requisito: Aislamiento por tienda (solo contrato productivo)
El sistema productivo DEBE proyectar exclusivamente datos autorizados para la tienda solicitada y NO DEBE combinar monedas sin conversión explícita.

#### Escenario: Acceso a otra tienda
- **DADO** que un usuario no pertenece a otra tienda.
- **CUANDO** solicita su proyección.
- **ENTONCES** se deniega el acceso.

### Requisito: Evitar duplicación de ventas futuras confirmadas
El sistema DEBE tratar las ventas futuras de contado confirmadas como parte de la estimación diaria, no como un ingreso adicional.

#### Escenario: Ventas parcialmente confirmadas
- **DADO** que la estimación base diaria es COP 260.000.
- **Y** existen COP 100.000 de ventas confirmadas del mismo día futuro, no incluidas en el saldo inicial.
- **CUANDO** se calcula la proyección.
- **ENTONCES** los registros confirmados aportan COP 100.000.
- **Y** el residual estimado aporta COP 160.000.
- **Y** el total proyectado es COP 260.000.

#### Escenario: Ventas confirmadas superiores a la estimación
- **DADO** una estimación de COP 260.000 y COP 350.000 de ventas futuras confirmadas del mismo día.
- **CUANDO** se calcula la proyección.
- **ENTONCES** el residual estimado es cero.
- **Y** el total de ventas proyectadas es COP 350.000.

#### Escenario: Inclusión desconocida en saldo inicial
- **DADO** un evento confirmado sin declaración explícita de inclusión en el saldo inicial.
- **CUANDO** se valida la entrada.
- **ENTONCES** se rechaza por ambigüedad.
- **Y** no se añade otro ingreso.

#### Escenario: Evento ya incluido en saldo inicial
- **DADO** un evento confirmado marcado como ya incluido en el saldo inicial.
- **CUANDO** se envía como evento futuro.
- **ENTONCES** se rechaza en lugar de volver a sumarlo.

### Requisito: Conciliar obligaciones recurrentes por identidad estable
El sistema DEBE representar cada obligación por separado de su regla recurrente y asociar pagos mediante `obligationId`, nunca únicamente por fecha e importe.

#### Escenario: Abono previo al corte
- **DADO** un alquiler de COP 1.300.000 con COP 500.000 pagados antes del corte.
- **CUANDO** se genera la proyección.
- **ENTONCES** solo se proyectan COP 800.000 pendientes.
- **Y** los COP 500.000 ya contabilizados no vuelven a salir de caja.

#### Escenario: Abono confirmado dentro del horizonte
- **DADO** un alquiler de COP 1.300.000 con vencimiento el 1 de junio.
- **Y** un pago confirmado de COP 500.000 el 30 de mayo, no incluido en el saldo inicial.
- **CUANDO** se genera la proyección.
- **ENTONCES** se proyectan COP 500.000 el 30 de mayo.
- **Y** COP 800.000 el 1 de junio.
- **Y** la suma de salidas del alquiler es COP 1.300.000.

#### Escenario: Obligación totalmente pagada
- **DADO** una obligación de COP 1.300.000 totalmente pagada antes del corte.
- **CUANDO** se genera la proyección.
- **ENTONCES** no genera salida futura.

#### Escenario: Dos obligaciones del mismo importe
- **DADO** dos obligaciones diferentes de COP 1.300.000 con el mismo vencimiento.
- **CUANDO** se genera la proyección.
- **ENTONCES** ambas permanecen.

#### Escenario: Pago repetido
- **DADO** que un mismo identificador de pago aparece dos veces.
- **CUANDO** se genera la proyección.
- **ENTONCES** se rechaza la entrada, sin contar dos veces el pago.

#### Escenario: Sobrepago
- **DADO** que los pagos aplicados superan el total de la obligación.
- **CUANDO** se genera la proyección.
- **ENTONCES** se rechaza para corregir o gestionar explícitamente el anticipo.

#### Escenario: Período recurrente duplicado
- **DADO** dos obligaciones con la misma regla recurrente y período.
- **CUANDO** se genera la proyección.
- **ENTONCES** se rechaza el período duplicado.

#### Escenario: Pago programado después del vencimiento
- **DADO** un pago futuro vinculado cuya fecha supera el vencimiento de la obligación.
- **CUANDO** no existe política aprobada de reprogramación.
- **ENTONCES** se rechaza para no subestimar la necesidad de caja al vencimiento.

### Requisito: Procedencia y conciliación del saldo inicial
El sistema DEBE etiquetar el saldo como provisional salvo que exista fuente verificada y referencia de evidencia, y DEBE mostrar la diferencia entre saldo guardado y reconstruido.

#### Escenario: Saldos provisionales discrepantes
- **DADO** COP 1.900.000 guardados y COP 1.640.000 reconstruidos.
- **CUANDO** se genera la proyección sin evidencia verificada.
- **ENTONCES** se utiliza provisionalmente COP 1.640.000.
- **Y** se muestra la diferencia de COP 260.000.
- **Y** se recomienda conciliar.

#### Escenario: Saldo inicial verificado
- **DADO** un saldo verificado de COP 1.900.000 con referencia de evidencia y corte correcto.
- **CUANDO** se genera la proyección.
- **ENTONCES** el saldo seleccionado es COP 1.900.000.
- **Y** la discrepancia permanece visible para auditoría.
- **Y** los saldos de los escenarios aumentan COP 260.000 sin duplicar movimientos.

#### Escenario: Evidencia ausente o corte incorrecto
- **DADO** un saldo declarado verificado sin referencia de evidencia o con corte incompatible.
- **CUANDO** se solicita la proyección.
- **ENTONCES** se rechaza la entrada.

### Requisito: Sensibilidad de saldo sin probabilidades
El sistema DEBE mostrar el efecto de usar el saldo guardado o reconstruido sin describirlo como intervalo estadístico de confianza.

#### Escenario: Sensibilidad del saldo inicial
- **DADO** una discrepancia inicial de COP 260.000.
- **CUANDO** se comparan las dos referencias.
- **ENTONCES** el saldo final y mínimo de cada escenario difieren en COP 260.000.
- **Y** los movimientos proyectados permanecen idénticos.
