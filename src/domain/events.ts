import type { CashEvent, ForecastInput, Receivable, Scenario } from './types.ts';

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date: ' + date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function weekday(date: string): number { return new Date(`${date}T12:00:00Z`).getUTCDay(); }
export function validateAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Amounts must be nonnegative safe integers in COP');
}
function receiptDate(r: Receivable, scenario: Scenario, start: string): string | null {
  if (r.totalPayments === 0 || r.onTimePayments < 0 || r.onTimePayments > r.totalPayments) return null;
  const rate = r.onTimePayments / r.totalPayments;
  if (scenario === 'optimistic') return r.dueDate < start ? start : r.dueDate;
  if (scenario === 'conservative') {
    // Even historically punctual customers can slip. This is a stress scenario, not a probability.
    return addDays(r.dueDate < start ? start : r.dueDate, rate >= 0.75 ? 7 : 21);
  }
  if (r.expectedDateOverride) return r.expectedDateOverride;
  if (rate >= 0.75) return r.dueDate < start ? start : r.dueDate;
  // A past-due account with weak history is NOT assumed collectable within 14 days.
  if (r.dueDate < start) return null;
  return addDays(r.dueDate, Math.max(1, Math.round(r.averageLateDays)));
}
export function buildEvents(input: ForecastInput, scenario: Scenario): CashEvent[] {
  const events: CashEvent[] = [];
  const saleFactors: Record<Scenario, number> = { conservative: 0.8, base: 1, optimistic: 1.15 };
  const horizonEnd = addDays(input.startDate, input.days - 1);
  const confirmedSalesByDay = new Map<string, number>();
  const confirmedEvents = input.confirmedFutureEvents ?? [];
  for (const e of confirmedEvents) {
    validateAmount(e.amount);
    if (e.includedInOpeningBalance !== false) {
      throw new Error(`Event ${e.id} must explicitly declare includedInOpeningBalance: false`);
    }
    if (e.date < input.startDate || e.date > horizonEnd) {
      throw new Error(`Confirmed future event ${e.id} must be within forecast horizon`);
    }
    if (e.source !== 'confirmed') throw new Error(`Future event ${e.id} must be confirmed`);
    if (e.category === 'cash_sales') {
      if (e.direction !== 'in') throw new Error(`Cash sale ${e.id} must be an inflow`);
      const sum = (confirmedSalesByDay.get(e.date) ?? 0) + e.amount;
      if (!Number.isSafeInteger(sum)) throw new Error('Confirmed daily sales overflow');
      confirmedSalesByDay.set(e.date, sum);
    }
  }
  for (let i = 0; i < input.days; i++) {
    const date = addDays(input.startDate, i);
    const day = weekday(date);
    const base = day === 0 ? 0 : (day === 5 || day === 6 ? input.baselineSales.fridaySaturday : input.baselineSales.weekday);
    const boost = input.fortnightDates.includes(date) ? 1.3 : 1;
    const estimatedTotalSales = Math.round(base * boost * saleFactors[scenario]);
    // Confirmed cash sales are a subset of the daily estimate, not an extra inflow.
    const confirmedSales = confirmedSalesByDay.get(date) ?? 0;
    const residualEstimate = Math.max(0, estimatedTotalSales - confirmedSales);
    if (residualEstimate > 0) events.push({ id: `sales-${date}`, date, amount: residualEstimate, direction: 'in', source: 'assumed', category: 'cash_sales', description: 'Ventas de contado estimadas restantes tras descontar las confirmadas' });
    // Daily cash expense is assumed to occur on operating days only: explicitly stated assumption.
    if (day !== 0 && input.dailyCashExpenses > 0) events.push({ id: `daily-expense-${date}`, date, amount: input.dailyCashExpenses, direction: 'out', source: 'assumed', category: 'expense', description: 'Gasto operativo diario estimado' });
  }
  for (const r of input.receivables) {
    validateAmount(r.pendingAmount);
    const date = receiptDate(r, scenario, input.startDate);
    if (date) events.push({ id: `receivable-${r.id}`, date, amount: r.pendingAmount, direction: 'in', source: 'assumed', category: 'receivable', description: `Cobro estimado: ${r.customer}` });
  }
  // Reconcile by obligation identity, never by matching date/amount.
  // The opening balance already reflects paidBeforeCutoff; only future
  // payments and the remaining unpaid portion generate future outflows.
  const obligationsById = new Map<string, (typeof input.obligations)[number]>();
  const recurrencePeriods = new Set<string>();
  for (const o of input.obligations) {
    validateAmount(o.amount);
    validateAmount(o.paidBeforeCutoff ?? 0);
    if ((o.paidBeforeCutoff ?? 0) > o.amount) throw new Error(`Prior payments exceed obligation ${o.id}`);
    if (obligationsById.has(o.id)) throw new Error(`Duplicate obligation id: ${o.id}`);
    obligationsById.set(o.id, o);
    if (o.recurrenceId || o.periodKey) {
      if (!o.recurrenceId || !o.periodKey) throw new Error(`Obligation ${o.id} requires recurrenceId and periodKey together`);
      const key = JSON.stringify([o.recurrenceId, o.periodKey]);
      if (recurrencePeriods.has(key)) throw new Error(`Duplicate recurrence period for obligation ${o.id}`);
      recurrencePeriods.add(key);
    }
  }
  const paymentsByObligation = new Map<string, number>();
  const paymentIds = new Set<string>();
  for (const payment of input.obligationPayments ?? []) {
    validateAmount(payment.amount);
    if (paymentIds.has(payment.id)) throw new Error(`Duplicate payment id: ${payment.id}`);
    paymentIds.add(payment.id);
    if (!obligationsById.has(payment.obligationId)) throw new Error(`Unknown obligation for payment ${payment.id}`);
    if (payment.includedInOpeningBalance !== false) throw new Error(`Payment ${payment.id} must explicitly declare includedInOpeningBalance: false`);
    if (payment.date < input.startDate || payment.date > horizonEnd) throw new Error(`Payment ${payment.id} must be within forecast horizon`);
    if (payment.date > obligationsById.get(payment.obligationId)!.date) throw new Error(`Payment ${payment.id} after obligation due date requires a separate rescheduling policy`);
    const sum = (paymentsByObligation.get(payment.obligationId) ?? 0) + payment.amount;
    if (!Number.isSafeInteger(sum)) throw new Error(`Payment amount overflow for ${payment.obligationId}`);
    paymentsByObligation.set(payment.obligationId, sum);
    if (payment.amount > 0) events.push({ id: `obligation-payment-${payment.id}`, date: payment.date, amount: payment.amount, direction: 'out', source: 'confirmed', category: obligationsById.get(payment.obligationId)!.category, description: `Pago confirmado de la obligación ${payment.obligationId}` });
  }
  for (const o of input.obligations) {
    const futurePaid = paymentsByObligation.get(o.id) ?? 0;
    const remaining = o.amount - (o.paidBeforeCutoff ?? 0) - futurePaid;
    if (remaining < 0) throw new Error(`Payments exceed obligation ${o.id}`);
    if (remaining > 0) events.push({ id: o.id, date: o.date < input.startDate ? input.startDate : o.date, amount: remaining, direction: 'out', source: o.source, category: o.category, description: `Saldo pendiente de la obligación: ${o.description}` });
  }
  // Generic events cannot masquerade as linked obligation payments.
  for (const e of confirmedEvents) events.push(e);
  const ids = new Set<string>();
  for (const e of events) { if (ids.has(e.id)) throw new Error('Duplicate event id: ' + e.id); ids.add(e.id); }
  return events;
}
