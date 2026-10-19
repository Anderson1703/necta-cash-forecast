# Demostración del endpoint (3 minutos)

## Preparación
Requisitos: Node.js 22 o superior. Abrir terminal en raíz del proyecto.

Terminal 1:
```bash
npm test
npm start
```

Terminal 2:
```bash
curl -s 'http://localhost:3000/v2/stores/demo/cash-forecast?days=14' > /tmp/necta-forecast.json
node -e 'const r=require("/tmp/necta-forecast.json");console.log(JSON.stringify({startDate:r.startDate,days:r.days,balanceDiscrepancy:r.balanceDiscrepancy,dataQuality:r.dataQuality,scenarios:Object.fromEntries(Object.entries(r.scenarios).map(([k,v])=>[k,{endingBalance:v.endingBalance,minimumBalance:v.minimumBalance,firstShortfallDate:v.firstShortfallDate}])),recommendations:r.recommendations},null,2))'
```

Nota: `/tmp/necta-forecast.json` es solo un archivo local de demo.

## Resultado esperado para fixture Carmen
- Fecha de inicio: 2026-05-25, 14 días.
- Diferencia de saldos: COP 260.000.
- Calidad de datos: `low`, cobertura estimada 20–30%.
- Conservador: saldo final -62.400; mínimo -3.768.400; primer déficit 2026-05-29.
- Base: saldo final 1.682.000; mínimo -538.000; primer déficit 2026-06-01.
- Optimista: saldo final 4.402.800; mínimo 1.640.000; sin déficit.

## Demostración de eventos
```bash
node -e 'const r=require("/tmp/necta-forecast.json");for(const scenario of ["conservative","base","optimistic"]){const d=r.scenarios[scenario].days.find(d=>d.date==="2026-05-29");console.log(scenario,{date:d.date,opening:d.openingBalance,inflows:d.inflows,outflows:d.outflows,closing:d.closingBalance,events:d.events.map(e=>({id:e.id,amount:e.amount,direction:e.direction,source:e.source}))})}'
```

## Validación de errores
```bash
curl -i 'http://localhost:3000/v2/stores/demo/cash-forecast?days=15'
curl -i 'http://localhost:3000/otra-ruta'
```
Esperado: HTTP 400 para horizonte inválido; HTTP 404 para ruta desconocida.

## Frases clave al mostrar la demo
- «El endpoint usa una fixture, no datos reales ni MongoDB».
- «La diferencia de COP 260.000 se expone, no se oculta ni se promedia».
- «El escenario base acaba positivo, pero cae por debajo de cero el 1 de junio».
- «Las alertas son eventos de dominio; no se envían notificaciones».
- «La calidad baja no es una probabilidad de incumplimiento».
