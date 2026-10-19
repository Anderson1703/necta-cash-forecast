import type { ForecastInput, OpeningBalance, DataQualityAssessment, QualityFinding } from './types.ts';

/** Explainable policy categories, never a statistical probability. */
export function assessDataQuality(input: ForecastInput, opening: OpeningBalance): DataQualityAssessment {
  const findings: QualityFinding[] = [];
  const coverage = input.coverageEstimate;
  if (!coverage) {
    findings.push({ code: 'COVERAGE_UNKNOWN', severity: 'high', detail: 'No se ha medido la cobertura del registro de transacciones.' });
  } else {
    if (![coverage.min, coverage.max].every(v => Number.isFinite(v) && v >= 0 && v <= 1) || coverage.min > coverage.max) {
      throw new Error('coverageEstimate must be an ordered interval between 0 and 1');
    }
    if (coverage.max < 0.5) findings.push({ code: 'LOW_COVERAGE', severity: 'high', detail: `Solo se registra entre el ${Math.round(coverage.min * 100)} % y el ${Math.round(coverage.max * 100)} % de las transacciones.` });
    else if (coverage.min < 0.8) findings.push({ code: 'PARTIAL_COVERAGE', severity: 'medium', detail: 'El registro de transacciones está incompleto.' });
  }
  if (opening.status !== 'verified') findings.push({ code: 'PROVISIONAL_OPENING', severity: 'medium', detail: 'El saldo inicial no se ha verificado de forma independiente.' });
  if (input.storedBalance !== input.reconstructedBalance) findings.push({ code: 'BALANCE_MISMATCH', severity: 'medium', detail: 'El saldo guardado no coincide con el saldo reconstruido.' });
  if (input.receivables.some(r => r.totalPayments === 0)) findings.push({ code: 'MISSING_PAYMENT_HISTORY', severity: 'medium', detail: 'Algunos clientes no tienen historial de pagos.' });
  if (input.obligations.some(o => o.source === 'assumed')) findings.push({ code: 'INFERRED_OBLIGATIONS', severity: 'medium', detail: 'Algunas obligaciones futuras son estimadas y aún no se han verificado.' });
  const level = findings.some(f => f.severity === 'high') ? 'low' : findings.length > 0 ? 'medium' : 'high';
  return { level, findings, method: 'Evaluación de integridad basada en reglas; no es una puntuación de confianza estadísticamente calibrada.' };
}
