import type { ForecastInput, Scenario, ScenarioResult, DataQualityAssessment, ForecastAlert, Recommendation } from './types.ts';

const SCENARIOS: Scenario[] = ['conservative', 'base', 'optimistic'];

/** Domain alerts only: no push/email/WhatsApp side effects. */
export function deriveAlerts(input: ForecastInput, scenarios: Record<Scenario, ScenarioResult>, quality: DataQualityAssessment): ForecastAlert[] {
  const alerts: ForecastAlert[] = [];
  for (const scenario of SCENARIOS) {
    const first = scenarios[scenario].firstShortfallDate;
    if (first) alerts.push({ id: `shortfall:${scenario}:${first}`, code: 'CASH_SHORTFALL', severity: scenario === 'base' ? 'critical' : 'warning', scenario, date: first, message: `Se proyecta un saldo de caja negativo al cierre del ${first} (escenario ${scenario === "conservative" ? "conservador" : scenario === "base" ? "base" : "optimista"}).`, evidence: [`scenarios.${scenario}.firstShortfallDate`] });
  }
  if (quality.level === 'low') alerts.push({ id: `data-quality:${input.startDate}`, code: 'DATA_QUALITY_LOW', severity: 'warning', date: input.startDate, message: 'La proyección utiliza registros financieros incompletos. Concilia los datos antes de tomar decisiones basadas en ella.', evidence: quality.findings.map(f => f.code) });
  const base = scenarios.base;
  const nextCritical = input.obligations.filter(o => o.amount >= 1_000_000 && o.date >= input.startDate && o.date <= base.days[base.days.length - 1].date);
  for (const o of nextCritical) {
    const point = base.days.find(d => d.date === o.date);
    if (point && point.closingBalance < o.amount && point.closingBalance >= 0) {
      // Do not claim inability to pay: EOD balance does not establish intraday order.
      alerts.push({ id: `review-obligation:${o.id}:${o.date}`, code: 'REVIEW_LARGE_OBLIGATION', severity: 'info', date: o.date, message: `Revisa la disponibilidad de caja y el horario de pago de ${o.description}; el saldo al cierre no garantiza liquidez durante el día.`, evidence: [`obligations.${o.id}`] });
    }
  }
  return alerts;
}

export function deriveRecommendations(quality: DataQualityAssessment, alerts: ForecastAlert[], discrepancy: number): Recommendation[] {
  const recommendations: Recommendation[] = [];
  if (discrepancy !== 0) recommendations.push({ code: 'RECONCILE_BALANCE', priority: 'high', message: 'Confirma el saldo real de caja y banco, y concilia la diferencia.', evidence: ['storedBalance', 'reconstructedBalance'] });
  if (quality.findings.some(f => f.code === 'LOW_COVERAGE' || f.code === 'COVERAGE_UNKNOWN')) recommendations.push({ code: 'IMPROVE_RECORDING', priority: 'high', message: 'Registra las ventas de contado y los gastos faltantes; no consideres los saldos proyectados como dinero confirmado.', evidence: ['dataQuality.findings'] });
  const firstShortfall = alerts.find(a => a.code === 'CASH_SHORTFALL' && a.scenario === 'conservative');
  if (firstShortfall) recommendations.push({ code: 'NEGOTIATE_PAYMENT', priority: 'high', message: `Confirma los cobros pendientes y negocia las fechas de pago antes del ${firstShortfall.date}.`, evidence: [firstShortfall.id] });
  if (alerts.some(a => a.code === 'REVIEW_LARGE_OBLIGATION')) recommendations.push({ code: 'VERIFY_PAYMENT_TIMING', priority: 'medium', message: 'Confirma las fechas de las obligaciones importantes y de los cobros previstos antes de comprometer fondos.', evidence: alerts.filter(a => a.code === 'REVIEW_LARGE_OBLIGATION').map(a => a.id) });
  return recommendations;
}
