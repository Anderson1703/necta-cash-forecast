import { addDays, buildEvents, validateAmount } from './events.ts';
import { assessDataQuality } from './quality.ts';
import { deriveAlerts, deriveRecommendations } from './alerts.ts';
import type { ForecastInput, ForecastResult, Scenario, ScenarioResult, Recommendation, OpeningBalance, BalanceSensitivity } from './types.ts';
const SCENARIOS: Scenario[] = ['conservative', 'base', 'optimistic'];
export function forecastCash(input: ForecastInput): ForecastResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error('startDate must be YYYY-MM-DD');
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 14) throw new Error('days must be between 1 and 14');
  validateAmount(input.storedBalance); validateAmount(input.reconstructedBalance); validateAmount(input.dailyCashExpenses);
  const opening: OpeningBalance = input.openingBalance ?? {
    amount: input.reconstructedBalance,
    asOfDate: input.startDate,
    status: 'provisional',
    source: 'reconstructed'
  };
  validateAmount(opening.amount);
  if (opening.asOfDate !== input.startDate) throw new Error('Opening balance cutoff must match startDate');
  if (opening.status === 'verified') {
    if (!['bank_verified', 'cash_count'].includes(opening.source) || !opening.evidenceId?.trim()) {
      throw new Error('Verified balance requires a verified source and evidenceId');
    }
  } else if (!['reconstructed', 'stored_snapshot'].includes(opening.source)) {
    throw new Error('Provisional balance requires reconstructed or stored_snapshot source');
  }
  const scenarios = {} as Record<Scenario, ScenarioResult>;
  for (const scenario of SCENARIOS) {
    const allEvents = buildEvents(input, scenario);
    let balance = opening.amount;
    let minimumBalance = balance;
    let firstShortfallDate: string | null = null;
    const days = Array.from({ length: input.days }, (_, index) => {
      const date = addDays(input.startDate, index);
      const events = allEvents.filter(e => e.date === date);
      const inflows = events.filter(e => e.direction === 'in').reduce((sum, e) => sum + e.amount, 0);
      const outflows = events.filter(e => e.direction === 'out').reduce((sum, e) => sum + e.amount, 0);
      const openingBalance = balance;
      balance += inflows - outflows;
      minimumBalance = Math.min(minimumBalance, balance);
      if (balance < 0 && !firstShortfallDate) firstShortfallDate = date;
      return { date, openingBalance, inflows, outflows, closingBalance: balance, events };
    });
    scenarios[scenario] = { scenario, days, endingBalance: balance, minimumBalance, firstShortfallDate };
  }
  const balanceDiscrepancy = input.storedBalance - input.reconstructedBalance;
  // Recalculate sensitivity using the SAME daily movements, shifting only the
  // opening balance. These are reconciliation alternatives, NOT probabilities.
  const alternatives: BalanceSensitivity[] = (['reconstructed', 'stored'] as const).map(reference => {
    const candidate = reference === 'stored' ? input.storedBalance : input.reconstructedBalance;
    const offset = candidate - opening.amount;
    const projected = {} as BalanceSensitivity['scenarios'];
    for (const scenario of SCENARIOS) {
      const points = scenarios[scenario].days;
      const balances = [candidate, ...points.map(p => p.closingBalance + offset)];
      projected[scenario] = {
        endingBalance: balances[balances.length - 1],
        minimumBalance: Math.min(...balances),
        firstShortfallDate: points.find(p => p.closingBalance + offset < 0)?.date ?? null
      };
    }
    return { reference, openingBalance: candidate, scenarios: projected };
  });
  const balanceAssessment = {
    selected: opening,
    reconciled: balanceDiscrepancy === 0 || opening.status === 'verified',
    difference: balanceDiscrepancy,
    alternatives,
    note: 'Las alternativas de saldo guardado y reconstruido son análisis de sensibilidad, no intervalos estadísticos de confianza. Un saldo verificado requiere evidencia validada externamente.'
  };
  const qualityWarnings: string[] = [];
  if (opening.status === 'provisional') qualityWarnings.push('El saldo inicial es provisional; confírmalo con un extracto bancario o un arqueo de caja.');
  if (balanceDiscrepancy !== 0) qualityWarnings.push(`Diferencia entre el saldo guardado y el reconstruido: COP ${balanceDiscrepancy}`);
  if (input.coverageEstimate) qualityWarnings.push(`Solo se registra entre el ${Math.round(input.coverageEstimate.min*100)} % y el ${Math.round(input.coverageEstimate.max*100)} % de las transacciones; las estimaciones de los escenarios son inciertas.`);
  if (input.receivables.some(r => r.totalPayments === 0)) qualityWarnings.push('Algunas cuentas por cobrar no tienen historial de pagos y se excluyen de las estimaciones automáticas de cobro.');
  const dataQuality = assessDataQuality(input, opening);
  const alerts = deriveAlerts(input, scenarios, dataQuality);
  const recommendations = deriveRecommendations(dataQuality, alerts, balanceDiscrepancy);
  return { currency: 'COP', startDate: input.startDate, days: input.days, balanceDiscrepancy, balanceAssessment, qualityWarnings, dataQuality, alerts, scenarios, recommendations, assumptions: [
    'El saldo inicial predeterminado es el saldo reconstruido provisional; para verificarlo se requiere una referencia explícita a evidencia confiable.',
    'La comparación de sensibilidad entre saldos guardados y reconstruidos modifica únicamente el saldo inicial, no los flujos proyectados; no representa intervalos de confianza.',
    'Los escenarios son simulaciones heurísticas de estrés, no probabilidades calibradas.',
    'Las ventas de contado futuras confirmadas sustituyen la parte equivalente de la estimación diaria hasta agotarla; cualquier excedente se mantiene como confirmado.',
    'Los eventos futuros confirmados deben ser posteriores al corte del saldo inicial y estar excluidos explícitamente de ese saldo.',
    'Los gastos diarios de caja se aplican de lunes a sábado; se supone que los domingos el negocio está cerrado.',
    'Las fechas del incremento de ventas por quincena se proporcionan explícitamente; el caso no define sus límites exactos.',
    'En el escenario base no se presupone el cobro automático de cuentas sin historial ni de cuentas vencidas con antecedentes desfavorables.',
    'Las obligaciones recurrentes proporcionadas son supuestos ilustrativos, no asientos contables confirmados.'
  ] };
}
