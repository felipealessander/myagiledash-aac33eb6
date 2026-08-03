/**
 * Funções puras de comparação entre meses.
 * Usadas por todos os blocos do dashboard que suportam análise multi-mês,
 * garantindo que widget, gráfico e detalhamento usem a MESMA regra.
 */

export interface MonthValue {
  month: string;   // "2026-05"
  label: string;   // "Mai/26"
  value: number;
  /** false quando o mês não possui registros no período. */
  hasData: boolean;
}

export type PeriodKind = "year" | "single" | "multi" | "range";

export interface PeriodSummary {
  kind: PeriodKind;
  label: string;
  months: string[];
}

const MONTHS_PT = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function monthShortLabel(month: string): string {
  const [y, m] = month.split("-");
  const idx = parseInt(m || "0", 10);
  if (!y || !idx || !MONTHS_PT[idx]) return month;
  return `${MONTHS_PT[idx]}/${y.slice(2)}`;
}

/** Meses consecutivos formam um intervalo. */
export function isConsecutive(months: string[]): boolean {
  if (months.length < 2) return false;
  const sorted = [...months].sort();
  for (let i = 1; i < sorted.length; i++) {
    const [py, pm] = sorted[i - 1].split("-").map(Number);
    const [cy, cm] = sorted[i].split("-").map(Number);
    const diff = (cy - py) * 12 + (cm - pm);
    if (diff !== 1) return false;
  }
  return true;
}

/**
 * Descreve o período ativo para exibição em todos os blocos.
 * `selected` vazio => consolidado do ano `year`.
 */
export function describePeriod(selected: string[], year: string, yearMonths: string[]): PeriodSummary {
  if (selected.length === 0) {
    return { kind: "year", label: `Ano ${year} (consolidado)`, months: [...yearMonths].sort() };
  }
  const sorted = [...selected].sort();
  if (sorted.length === 1) {
    return { kind: "single", label: monthShortLabel(sorted[0]), months: sorted };
  }
  if (yearMonths.length > 0 && sorted.length === yearMonths.length) {
    return { kind: "year", label: `Ano ${year} (consolidado)`, months: sorted };
  }
  if (isConsecutive(sorted)) {
    return {
      kind: "range",
      label: `${monthShortLabel(sorted[0])} → ${monthShortLabel(sorted[sorted.length - 1])}`,
      months: sorted,
    };
  }
  return {
    kind: "multi",
    label: `${sorted.length} meses: ${sorted.map(monthShortLabel).join(", ")}`,
    months: sorted,
  };
}

/** Variação absoluta entre dois valores (arredondada a 1 casa). */
export function absoluteDelta(current: number, previous: number): number {
  return Math.round((current - previous) * 10) / 10;
}

/**
 * Variação percentual. Retorna null quando a base é zero
 * (crescimento a partir de zero não é percentualmente representável).
 */
export function percentDelta(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/**
 * Alinha uma série ao conjunto de meses selecionados, preenchendo meses
 * sem registros com valor 0 e `hasData: false` (nunca some do gráfico).
 */
export function alignMonths(
  points: { month: string; value: number }[],
  months: string[],
): MonthValue[] {
  const map = new Map(points.map(p => [p.month, p.value]));
  return [...months].sort().map(month => ({
    month,
    label: monthShortLabel(month),
    value: map.get(month) ?? 0,
    hasData: map.has(month),
  }));
}

export interface ComparisonRow extends MonthValue {
  /** Variação em relação ao mês anterior da própria seleção. */
  delta: number | null;
  deltaPct: number | null;
}

/** Série comparativa com variação mês a mês. */
export function buildComparison(
  points: { month: string; value: number }[],
  months: string[],
): ComparisonRow[] {
  const aligned = alignMonths(points, months);
  return aligned.map((p, i) => {
    if (i === 0) return { ...p, delta: null, deltaPct: null };
    const prev = aligned[i - 1].value;
    return { ...p, delta: absoluteDelta(p.value, prev), deltaPct: percentDelta(p.value, prev) };
  });
}

/** Total e média da seleção (média considera apenas meses com dados). */
export function summarizeSeries(rows: MonthValue[]): { total: number; avg: number; withData: number } {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const withData = rows.filter(r => r.hasData).length;
  return {
    total: Math.round(total * 10) / 10,
    avg: withData > 0 ? Math.round((total / withData) * 10) / 10 : 0,
    withData,
  };
}

/** Amostra mínima para exibir estatísticas de fluxo (mediana/P85). */
export const MIN_SAMPLE = 3;

export function hasEnoughData(count: number): boolean {
  return count >= MIN_SAMPLE;
}
