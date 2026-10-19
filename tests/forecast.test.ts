import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastCash } from '../src/domain/forecast.ts';
import { carmen } from '../src/fixtures/carmen.ts';
import { addDays } from '../src/domain/events.ts';
test('14 dates and daily cash continuity', () => {
  const f = forecastCash(carmen);
  for (const scenario of ['conservative','base','optimistic'] as const) {
    assert.equal(f.scenarios[scenario].days.length,14);
    for (let i=1;i<14;i++) assert.equal(f.scenarios[scenario].days[i].openingBalance, f.scenarios[scenario].days[i-1].closingBalance);
  }
});
test('supplier obligation counted exactly once in each scenario', () => {
  const f=forecastCash(carmen);
  for (const scenario of ['conservative','base','optimistic'] as const) {
    const matches=f.scenarios[scenario].days.flatMap(d=>d.events).filter(e=>e.id==='supplier');
    assert.equal(matches.length,1); assert.equal(matches[0].amount,4_200_000);
  }
});
test('overdue risky receivable is not optimistically included in base case', () => {
  const f=forecastCash(carmen);
  assert.equal(f.scenarios.base.days.flatMap(d=>d.events).filter(e=>e.id==='receivable-sol').length,0);
});
test('Friday shortfall is surfaced in conservative scenario', () => {
  const f=forecastCash(carmen);
  assert.ok(f.scenarios.conservative.days.find(d=>d.date==='2026-05-29')!.closingBalance < 0);
  assert.ok(f.recommendations.some(r=>r.code==='NEGOTIATE_PAYMENT'));
});
test('balance discrepancy and sparse coverage warnings', () => {
  const f=forecastCash(carmen);
  assert.equal(f.balanceDiscrepancy,260_000); assert.ok(f.qualityWarnings.length>=2);
});
test('partial payment lowers projected remaining collection', () => {
  const modified=structuredClone(carmen);
  modified.receivables[0].pendingAmount=1_000_000;
  const f=forecastCash(modified);
  assert.equal(f.scenarios.base.days.flatMap(d=>d.events).find(e=>e.id==='receivable-brisas')?.amount,1_000_000);
});
test('due date outside horizon is excluded', () => {
  const f=forecastCash(carmen);
  assert.equal(f.scenarios.base.days.flatMap(d=>d.events).some(e=>e.id==='receivable-others'),false);
});
test('rejects invalid days and duplicate IDs', () => {
  assert.throws(()=>forecastCash({...carmen,days:15}));
  assert.throws(()=>forecastCash({...carmen,obligations:[...carmen.obligations,carmen.obligations[0]]}),/Duplicate (event|obligation) id/);
});
test('calendar arithmetic crosses months',()=>assert.equal(addDays('2026-05-31',1),'2026-06-01'));

function confirmedSale(date: string, amount: number, id = 'confirmed-sale') {
  return { id, date, amount, direction: 'in' as const, source: 'confirmed' as const, category: 'cash_sales' as const, description: 'Confirmed future sale', includedInOpeningBalance: false };
}
test('confirmed sales replace part of the daily estimate in all scenarios', () => {
  const input = structuredClone(carmen);
  input.confirmedFutureEvents = [confirmedSale('2026-05-26', 100_000)];
  const f = forecastCash(input);
  for (const [scenario, expectedEstimate] of [['conservative',108_000],['base',160_000],['optimistic',199_000]] as const) {
    const day = f.scenarios[scenario].days.find(d => d.date === '2026-05-26')!;
    assert.equal(day.events.find(e => e.id === 'confirmed-sale')?.amount, 100_000);
    assert.equal(day.events.find(e => e.id === 'sales-2026-05-26')?.amount, expectedEstimate);
    assert.equal(day.events.filter(e => e.category === 'cash_sales').reduce((sum,e)=>sum+e.amount,0), expectedEstimate+100_000);
  }
});
test('multiple confirmed sales on one day are aggregated for residual estimate', () => {
  const input = structuredClone(carmen);
  input.confirmedFutureEvents = [confirmedSale('2026-05-26', 60_000, 'a'), confirmedSale('2026-05-26', 40_000, 'b')];
  const day = forecastCash(input).scenarios.base.days.find(d=>d.date==='2026-05-26')!;
  assert.equal(day.events.find(e=>e.id==='sales-2026-05-26')?.amount,160_000);
  assert.equal(day.events.filter(e=>e.category==='cash_sales').reduce((sum,e)=>sum+e.amount,0),260_000);
});
test('confirmed sales greater than estimate remain fully counted without negative residual', () => {
  const input = structuredClone(carmen);
  input.confirmedFutureEvents = [confirmedSale('2026-05-26', 350_000)];
  for (const scenario of ['conservative','base','optimistic'] as const) {
    const day = forecastCash(input).scenarios[scenario].days.find(d=>d.date==='2026-05-26')!;
    assert.equal(day.events.filter(e=>e.category==='cash_sales').reduce((sum,e)=>sum+e.amount,0),350_000);
    assert.equal(day.events.some(e=>e.id==='sales-2026-05-26'),false);
  }
});
test('rejects already booked or ambiguous future events', () => {
  const input = structuredClone(carmen);
  input.confirmedFutureEvents = [{...confirmedSale('2026-05-26',100_000),includedInOpeningBalance:true}];
  assert.throws(()=>forecastCash(input),/includedInOpeningBalance/);
  input.confirmedFutureEvents = [{...confirmedSale('2026-05-26',100_000),includedInOpeningBalance:undefined}];
  assert.throws(()=>forecastCash(input),/includedInOpeningBalance/);
  input.confirmedFutureEvents = [confirmedSale('2026-05-24',100_000)];
  assert.throws(()=>forecastCash(input),/within forecast horizon/);
});
test('a confirmed future sale changes projected cash by only its excess over baseline', () => {
  const original = forecastCash(carmen);
  const input = structuredClone(carmen);
  input.confirmedFutureEvents = [confirmedSale('2026-05-26',100_000)];
  const updated = forecastCash(input);
  for (const scenario of ['conservative','base','optimistic'] as const) {
    assert.equal(updated.scenarios[scenario].endingBalance, original.scenarios[scenario].endingBalance);
  }
});


test('unpaid rent generates a single 1.3M outflow', () => {
  const f = forecastCash(carmen);
  const day = f.scenarios.base.days.find(d => d.date === '2026-06-01')!;
  assert.equal(day.events.find(e => e.id === 'rent')?.amount, 1_300_000);
});
test('payment before opening balance cutoff reduces remaining rent without second outflow', () => {
  const input = structuredClone(carmen);
  input.obligations.find(o => o.id === 'rent')!.paidBeforeCutoff = 500_000;
  const events = forecastCash(input).scenarios.base.days.flatMap(d => d.events);
  assert.equal(events.find(e => e.id === 'rent')?.amount, 800_000);
  assert.equal(events.filter(e => e.id.startsWith('obligation-payment-')).length, 0);
});
test('future partial rent payment is counted once on payment date and remainder on due date', () => {
  const input = structuredClone(carmen);
  input.obligationPayments = [{ id: 'rent-may30', obligationId: 'rent', date: '2026-05-30', amount: 500_000, includedInOpeningBalance: false }];
  const days = forecastCash(input).scenarios.base.days;
  assert.equal(days.find(d => d.date === '2026-05-30')!.events.find(e => e.id === 'obligation-payment-rent-may30')?.amount, 500_000);
  assert.equal(days.find(d => d.date === '2026-06-01')!.events.find(e => e.id === 'rent')?.amount, 800_000);
  assert.equal(days.flatMap(d => d.events).filter(e => e.id === 'rent' || e.id === 'obligation-payment-rent-may30').reduce((sum,e)=>sum+e.amount,0), 1_300_000);
});
test('fully paid obligation before cutoff creates no future expense', () => {
  const input = structuredClone(carmen);
  input.obligations.find(o => o.id === 'rent')!.paidBeforeCutoff = 1_300_000;
  const events = forecastCash(input).scenarios.base.days.flatMap(d => d.events);
  assert.equal(events.some(e => e.id === 'rent'), false);
});
test('same amount on different obligations is not deduplicated', () => {
  const input = structuredClone(carmen);
  input.obligations.push({ id: 'other-rent', date: '2026-06-01', amount: 1_300_000, description: 'Second legitimate obligation', source: 'confirmed', category: 'expense' });
  const events = forecastCash(input).scenarios.base.days.flatMap(d => d.events);
  assert.equal(events.filter(e => e.id === 'rent' || e.id === 'other-rent').length, 2);
});
test('duplicate payment IDs are rejected, including distinct linked obligations', () => {
  const input = structuredClone(carmen);
  input.obligationPayments = [
    { id: 'payment-1', obligationId: 'rent', date: '2026-05-30', amount: 200_000, includedInOpeningBalance: false },
    { id: 'payment-1', obligationId: 'payroll', date: '2026-05-30', amount: 100_000, includedInOpeningBalance: false }
  ];
  assert.throws(() => forecastCash(input), /Duplicate payment id/);
});
test('overpayment and ambiguous cutoff classification are rejected', () => {
  const input = structuredClone(carmen);
  input.obligationPayments = [{ id: 'over', obligationId: 'rent', date: '2026-05-30', amount: 1_300_001, includedInOpeningBalance: false }];
  assert.throws(() => forecastCash(input), /Payments exceed obligation/);
  input.obligationPayments = [{ id: 'ambiguous', obligationId: 'rent', date: '2026-05-30', amount: 500_000, includedInOpeningBalance: undefined as never }];
  assert.throws(() => forecastCash(input), /includedInOpeningBalance/);
});
test('recurrence identity and period cannot be duplicated', () => {
  const input = structuredClone(carmen);
  input.obligations.find(o => o.id === 'rent')!.recurrenceId = 'monthly-rent';
  input.obligations.find(o => o.id === 'rent')!.periodKey = '2026-06';
  input.obligations.push({ id: 'duplicate-rent', date: '2026-06-01', amount: 1_300_000, description: 'Duplicate rent', source: 'assumed', category: 'expense', recurrenceId: 'monthly-rent', periodKey: '2026-06' });
  assert.throws(() => forecastCash(input), /Duplicate recurrence period/);
});
test('future obligation payments preserve forecast accounting across scenarios', () => {
  const input = structuredClone(carmen);
  input.obligationPayments = [{ id: 'rent-part', obligationId: 'rent', date: '2026-05-30', amount: 500_000, includedInOpeningBalance: false }];
  const original = forecastCash(carmen);
  const updated = forecastCash(input);
  for (const scenario of ['conservative','base','optimistic'] as const) {
    assert.equal(updated.scenarios[scenario].endingBalance, original.scenarios[scenario].endingBalance);
    assert.equal(updated.scenarios[scenario].days.find(d=>d.date==='2026-05-30')!.closingBalance, original.scenarios[scenario].days.find(d=>d.date==='2026-05-30')!.closingBalance - 500_000);
  }
});

test('late planned payments require explicit rescheduling rather than understating due-date cash needs', () => {
  const input = structuredClone(carmen);
  input.obligationPayments = [{ id: 'late-rent', obligationId: 'rent', date: '2026-06-03', amount: 500_000, includedInOpeningBalance: false }];
  assert.throws(() => forecastCash(input), /after obligation due date/);
});


test('provisional opening is explicit and warns on discrepancy', () => {
  const f = forecastCash(carmen);
  assert.equal(f.balanceAssessment.selected.amount, 1_640_000);
  assert.equal(f.balanceAssessment.selected.status, 'provisional');
  assert.equal(f.balanceAssessment.reconciled, false);
  assert.equal(f.balanceAssessment.difference, 260_000);
  assert.ok(f.qualityWarnings.some(w => w.includes('provisional')));
});
test('sensitivity shifts daily balances by 260000 without changing events', () => {
  const f = forecastCash(carmen);
  const stored = f.balanceAssessment.alternatives.find(a => a.reference === 'stored')!;
  const reconstructed = f.balanceAssessment.alternatives.find(a => a.reference === 'reconstructed')!;
  for (const scenario of ['conservative','base','optimistic'] as const) {
    assert.equal(stored.scenarios[scenario].endingBalance - reconstructed.scenarios[scenario].endingBalance, 260_000);
    assert.equal(stored.scenarios[scenario].minimumBalance - reconstructed.scenarios[scenario].minimumBalance, 260_000);
  }
});
test('verified balance with evidence changes forecast and removes provisional warning', () => {
  const input = structuredClone(carmen);
  input.openingBalance = { amount: 1_900_000, asOfDate: input.startDate, status: 'verified', source: 'bank_verified', evidenceId: 'statement-001' };
  const f = forecastCash(input);
  assert.equal(f.scenarios.base.endingBalance - forecastCash(carmen).scenarios.base.endingBalance, 260_000);
  assert.equal(f.balanceAssessment.selected.status, 'verified');
  assert.equal(f.balanceAssessment.reconciled, true);
  assert.ok(!f.qualityWarnings.some(w => w.includes('provisional')));
  assert.equal(f.balanceDiscrepancy, 260_000);
});
test('cannot claim verification without verified source and evidence', () => {
  const input = structuredClone(carmen);
  input.openingBalance = { amount: 1_900_000, asOfDate: input.startDate, status: 'verified', source: 'stored_snapshot' };
  assert.throws(() => forecastCash(input), /verified source and evidenceId/);
  input.openingBalance = { amount: 1_900_000, asOfDate: input.startDate, status: 'verified', source: 'bank_verified' };
  assert.throws(() => forecastCash(input), /evidenceId/);
});
test('opening cutoff mismatch is rejected to prevent mixing posted transactions', () => {
  const input = structuredClone(carmen);
  input.openingBalance!.asOfDate = '2026-05-24';
  assert.throws(() => forecastCash(input), /cutoff/);
});
test('alternate opening can move a deficit date while preserving flows', () => {
  const f = forecastCash(carmen);
  for (const scenario of ['conservative','base','optimistic'] as const) {
    const stored = f.balanceAssessment.alternatives.find(a => a.reference === 'stored')!.scenarios[scenario];
    const reconstructed = f.balanceAssessment.alternatives.find(a => a.reference === 'reconstructed')!.scenarios[scenario];
    assert.ok(stored.minimumBalance >= reconstructed.minimumBalance);
  }
});

test('DEC-010: Carmen has low data quality independently of liquidity scenarios', () => {
  const result = forecastCash(carmen);
  assert.equal(result.dataQuality.level, 'low');
  assert.ok(result.dataQuality.findings.some(f => f.code === 'LOW_COVERAGE'));
  assert.ok(result.alerts.some(a => a.code === 'DATA_QUALITY_LOW'));
  assert.ok(result.recommendations.some(r => r.code === 'IMPROVE_RECORDING'));
});
test('DEC-010: invalid coverage bounds are rejected', () => {
  const input = structuredClone(carmen);
  input.coverageEstimate = { min: 0.7, max: 0.3 };
  assert.throws(() => forecastCash(input), /coverageEstimate/);
  input.coverageEstimate = { min: -0.1, max: 0.3 };
  assert.throws(() => forecastCash(input), /coverageEstimate/);
});
test('DEC-010: missing coverage is not treated as high quality', () => {
  const input = structuredClone(carmen);
  delete input.coverageEstimate;
  const result = forecastCash(input);
  assert.equal(result.dataQuality.level, 'low');
  assert.ok(result.dataQuality.findings.some(f => f.code === 'COVERAGE_UNKNOWN'));
});
test('DEC-010: verified, complete, reconciled input can reach high data quality', () => {
  const input = structuredClone(carmen);
  input.coverageEstimate = { min: 1, max: 1 };
  input.storedBalance = input.reconstructedBalance;
  input.openingBalance = { amount: 1_640_000, asOfDate: input.startDate, status: 'verified', source: 'cash_count', evidenceId: 'cash-count-1' };
  input.obligations = input.obligations.map(o => ({ ...o, source: 'confirmed' }));
  const result = forecastCash(input);
  assert.equal(result.dataQuality.level, 'high');
  assert.ok(!result.alerts.some(a => a.code === 'DATA_QUALITY_LOW'));
});
test('DEC-010: alert identifiers and recommendations are deterministic and not notifications', () => {
  const first = forecastCash(carmen);
  const second = forecastCash(carmen);
  assert.deepEqual(first.alerts, second.alerts);
  assert.ok(first.alerts.every(a => a.id && a.evidence.length > 0));
  assert.ok(first.recommendations.every(r => r.evidence.length > 0));
});
test('DEC-010: risk warnings are scenario-specific, not probabilities', () => {
  const result = forecastCash(carmen);
  for (const alert of result.alerts.filter(a => a.code === 'CASH_SHORTFALL')) {
    assert.equal(alert.date, result.scenarios[alert.scenario!].firstShortfallDate);
    assert.ok(['conservative', 'base', 'optimistic'].includes(alert.scenario!));
  }
  assert.match(result.dataQuality.method, /no es una puntuación de confianza estadísticamente calibrada/);
});
