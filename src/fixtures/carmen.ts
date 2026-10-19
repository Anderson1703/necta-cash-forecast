import type { ForecastInput } from '../domain/types.ts';
/** Fictional annex: Monday 2026-05-25 through Sunday 2026-06-07. */
export const carmen: ForecastInput = {
  startDate: '2026-05-25', days: 14, currency: 'COP',
  storedBalance: 1_900_000, reconstructedBalance: 1_640_000,
  openingBalance: { amount: 1_640_000, asOfDate: '2026-05-25', status: 'provisional', source: 'reconstructed' },
  coverageEstimate: { min: 0.2, max: 0.3 },
  baselineSales: { weekday: 260_000, fridaySaturday: 520_000 },
  dailyCashExpenses: 90_000,
  // ASSUMPTION for demo only: which dates receive the 30% fortnight uplift is unspecified.
  fortnightDates: ['2026-05-29','2026-05-30'],
  receivables: [
    { id:'brisas', customer:'Hotel Brisas', pendingAmount:2_100_000, dueDate:'2026-05-28', onTimePayments:6, totalPayments:6, averageLateDays:0 },
    { id:'sol', customer:'Minimercado Sol', pendingAmount:1_200_000, dueDate:'2026-05-05', onTimePayments:1, totalPayments:4, averageLateDays:18 },
    { id:'esquina', customer:'Tienda La Esquina', pendingAmount:850_000, dueDate:'2026-05-26', onTimePayments:2, totalPayments:5, averageLateDays:12 },
    { id:'fina', customer:'Tienda Doña Fina', pendingAmount:600_000, dueDate:'2026-05-29', onTimePayments:4, totalPayments:4, averageLateDays:0 },
    // 9 remaining stores are represented as a single cohort; exact due dates are unavailable.
    { id:'others', customer:'Otras nueve tiendas (grupo)', pendingAmount:850_000, dueDate:'2026-06-07', onTimePayments:22, totalPayments:31, averageLateDays:0 }
  ],
  obligations: [
    { id:'supplier', date:'2026-05-29', amount:4_200_000, description:'Principal supplier', source:'confirmed', category:'payable' },
    { id:'payroll', date:'2026-05-30', amount:1_400_000, description:'Fortnight payroll (not in ledger)', source:'assumed', category:'expense' },
    { id:'rent', date:'2026-06-01', amount:1_300_000, description:'Warehouse rent (not in ledger)', source:'assumed', category:'expense' }
    // Loan installment on the 10th is outside this 14-day horizon.
  ]
};
