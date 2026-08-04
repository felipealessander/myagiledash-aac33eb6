/**
 * Helpers puros de apresentação de gráficos do dashboard.
 * Mantidos fora dos componentes para permitir testes automatizados.
 */

/** Amostra mínima para que um indicador estatístico seja considerado válido. */
export const MIN_SAMPLE = 1;

export function hasSufficientData(count: number, min: number = MIN_SAMPLE): boolean {
  return Number.isFinite(count) && count >= min;
}

/**
 * Separa as séries com dados suficientes das que devem exibir "Dados insuficientes".
 */
export function splitBySufficiency<T extends { count: number }>(
  rows: T[],
  min: number = MIN_SAMPLE,
): { withData: T[]; insufficient: T[] } {
  const withData: T[] = [];
  const insufficient: T[] = [];
  for (const r of rows || []) {
    (hasSufficientData(r.count, min) ? withData : insufficient).push(r);
  }
  return { withData, insufficient };
}

/**
 * Linha de tendência por mínimos quadrados (regressão linear simples).
 * Retorna os valores ajustados, na mesma ordem/cardinalidade da entrada.
 *
 * `mask` permite excluir do ajuste períodos sem dados (meses vazios ou
 * ainda em curso). Esses períodos continuam recebendo o valor projetado
 * da reta, mas não puxam a inclinação para baixo.
 * Apoio visual — nunca substitui os valores reais.
 */
export function linearTrend(values: number[], mask?: boolean[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [round1(values[0])];
  const idx = values.map((_, i) => i).filter(i => (mask ? mask[i] : true));
  if (idx.length === 0) return values.map(round1);
  if (idx.length === 1) return values.map(() => round1(values[idx[0]]));
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const i of idx) {
    sx += i;
    sy += values[i];
    sxy += i * values[i];
    sxx += i * i;
  }
  const m = idx.length;
  const denom = m * sxx - sx * sx;
  if (denom === 0) return values.map(round1);
  const slope = (m * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / m;
  return values.map((_, i) => round1(intercept + slope * i));
}


/** "2026-08" do mês corrente (UTC). */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Máscara padrão da linha de tendência.
 *
 * Entram no ajuste apenas os períodos comparáveis:
 *  - meses sem registros (valor 0 / sem dados) ficam de fora, pois não são
 *    queda real de desempenho;
 *  - o mês corrente ainda em curso fica de fora, pois só tem dados parciais e
 *    invertia a inclinação (ex.: throughput crescente aparecia caindo).
 *
 * Se a exclusão deixar menos de 2 pontos, volta a considerar todos os meses
 * com dados — nunca produz uma reta sem base.
 */
export function buildTrendMask(
  values: number[],
  months?: (string | undefined)[],
  options: { hasData?: boolean[]; now?: Date } = {},
): boolean[] | undefined {
  const current = currentMonthKey(options.now ?? new Date());
  const withData = values.map((v, i) =>
    options.hasData ? !!options.hasData[i] : v !== 0,
  );
  const full = withData.map((ok, i) => ok && !(months && months[i] === current));
  if (full.filter(Boolean).length >= 2) return full;
  if (withData.filter(Boolean).length >= 2) return withData;
  return undefined;
}

export interface Variation {
  abs: number;
  /** null quando o valor anterior é 0 (variação percentual indefinida). */
  pct: number | null;
}

export function variation(previous: number, current: number): Variation {
  const abs = round1(current - previous);
  if (!previous) return { abs, pct: null };
  return { abs, pct: round1(((current - previous) / Math.abs(previous)) * 100) };
}

/** Adiciona `trend` e a variação vs. mês anterior a uma série mensal. */
export function withTrend<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
): (T & { trend: number; deltaAbs: number; deltaPct: number | null })[] {
  const values = rows.map(r => Number(r[key]) || 0);
  const months = rows.map(r => (typeof r.month === "string" ? r.month : undefined));
  const trend = linearTrend(values, buildTrendMask(values, months));

  return rows.map((r, i) => {
    const v = variation(i === 0 ? values[0] : values[i - 1], values[i]);
    return { ...r, trend: trend[i], deltaAbs: v.abs, deltaPct: i === 0 ? null : v.pct };
  });
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
