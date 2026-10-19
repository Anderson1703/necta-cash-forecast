# Necta — Caja a 14 días (technical case)

**Scope:** partial backend implementation, fictional fixture, OpenSpec design. Not production-ready. Written to support a technical walkthrough.

## Run

Requires Node.js >=22. TypeScript type checking requires locally available `tsc` / `@types/node`; runtime/test execution uses built-in Node TypeScript stripping.

```bash
npm test
npm start
curl 'http://localhost:3000/v2/stores/demo/cash-forecast?days=14'
```

## What is implemented
- Pure event-based daily forecast for 3 scenarios
- Date-based receivables, obligations, sales and operating expenses
- Balance discrepancy and sparse-data warnings
- Shortfall detection and recommendations
- Automated tests
- Demo HTTP endpoint using fictional Carmen fixture

## What is intentionally not implemented
Production authentication, MongoDB, BullMQ, offline Expo client, real AI extraction, live messaging and data synchronization. These are designed in OpenSpec only.

## Important caveats
- This is an **illustrative heuristic**, not a financial guarantee.
- Source case dates correspond to 2026-05-25 through 2026-06-07.
- For the remaining nine shops, exact due dates are unspecified: grouped at 2026-06-07 for demonstration.
- Fortnight boost dates are illustrative.
- The opening balance is reconstructed and disputed; not verified.
- Estimated cash sales should replace, not duplicate, already-accounted cash inflows.
- The loan due June 10 is outside this 14-day window.
- The case's partial data registration rate is a warning, not a basis for multiplying income by 4 or 5.
- No guarantee of collections from historically punctual customers.

## Presenting the work
Show a failing conservative scenario on May 29, compare with the base scenario, inspect event lists, explain how the 260k discrepancy affects confidence, and demonstrate tests. Disclose actual work time and AI prompts truthfully.

## DEC-007: Reconcile future confirmed sales against daily estimates
Confirmed future cash sales are not added on top of the daily sales baseline. The estimated residual is `max(0, scenario estimate - confirmed sales)`. Each confirmed future event must declare `includedInOpeningBalance: false`, and be dated within the forecast horizon. This prevents accidental inclusion of cash already reflected in the provisional opening balance. See `tests/forecast.test.ts` for five additional regression tests (14 tests total).


## DEC-008 — Obligations and linked payments

`Obligation.amount` is the original liability, `paidBeforeCutoff` is the portion already represented in the provisional opening balance, and `obligationPayments` contains confirmed future cash outflows linked by `obligationId`. The engine emits each future payment on its payment date, and only the remaining liability at the obligation due date. Do not also add linked payments to `confirmedFutureEvents`. The domain rejects duplicate payment IDs, overpayment, unknown obligations, ambiguous cutoff inclusion, and duplicate `(recurrenceId, periodKey)` instances. Production must enforce store/currency boundaries and perform authoritative ledger reconciliation.


## DEC-009: opening balance reconciliation

`openingBalance` explicitly carries `amount`, `asOfDate` (same date as forecast start, representing the opening cutoff), `status` (`provisional` or `verified`), `source`, and optional `evidenceId`. Without it, the engine defaults to the reconstructed balance **provisionally**. A `verified` opening requires `bank_verified` or `cash_count` and an `evidenceId`; real evidence authentication is outside this demo.

`balanceAssessment` exposes the selected reference, COP 260,000 discrepancy, and scenario sensitivities calculated by shifting the opening balance while preserving all future events. The two alternatives are **not confidence intervals**. The fixture remains provisional; do not claim that the bank statement has been checked.

## DEC-010: Data quality and proactive alerts (domain only)
`src/domain/quality.ts` assigns explainable quality categories from transaction coverage, opening-balance verification, reconciliation, payment history, and inferred obligations. `src/domain/alerts.ts` creates stable alert IDs and actionable recommendations. `ForecastResult.dataQuality` and `.alerts` expose both independently of liquidity scenarios. These categories are not calibrated probabilities. Alerts are **not delivered**: push/email/WhatsApp scheduling, approval, preferences and deduplication remain production work. See the `cash-alerts` OpenSpec requirements and `tests/forecast.test.ts`.

## Delivery review and video

- `delivery/OPEN_SPEC_AUDIT.md`: implementation/spec consistency and known gaps.
- `delivery/DEMO_ENDPOINT.md`: reproducible API walkthrough.
- `delivery/VIDEO_10_MINUTOS.md`: suggested 9:15 video outline; replace placeholders with truthful actual time and AI prompts.

Local verification: 36/36 tests passed; typecheck was blocked by unavailable `@types/node` in this runtime.

## Idioma de la entrega
La documentación de OpenSpec, el README, la auditoría y los guiones de demostración están en español. Se conservan en inglés los identificadores de código, nombres de campos, rutas, comandos y códigos de error para mantener compatibilidad con TypeScript y el contrato técnico. Los escenarios usan **DADO / CUANDO / ENTONCES** y los requisitos usan **DEBE**.
