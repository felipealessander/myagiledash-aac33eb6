/**
 * MTTR — Mean Time To Restore/Resolve dos incidentes.
 *
 * Regras (fonte única; qualquer widget deve consumir daqui):
 *  - Considera apenas cards classificados como Incidente (`taskRules.isIncident`),
 *    incluindo os tipos legados Bug / Defeito / Erro script.
 *  - DeadLetter é tratado à parte (`includeDeadletters` liga/desliga).
 *  - Arquivados nunca entram.
 *  - Só entram cards com abertura (`created_at_yt`) E conclusão (`resolved_at`).
 *  - Competência pela data de CONCLUSÃO.
 *  - Unidade: dias corridos (24h), porque incidente não espera dia útil.
 *  - Dedupe por `task_code` (troca de squad/status não duplica).
 */

import { dedupeByTaskCode, matchesPeriod, percentile } from "./flowMetrics";
import { isArchived, isDeadLetter, isIncident, round1 } from "./taskRules";

export interface MttrTask {
  task_code: string;
  title?: string | null;
  category?: string | null;
  squad?: string | null;
  status?: string | null;
  client?: string | null;
  tags?: string[] | null;
  created_at_yt?: string | null;
  resolved_at?: string | null;
}

export interface MttrItem {
  code: string;
  title: string;
  squad: string;
  client: string;
  createdAt: string;
  resolvedAt: string;
  days: number;
  isDeadLetter: boolean;
}

export interface MttrResult {
  count: number;
  avg: number;
  median: number;
  p85: number;
  min: number;
  max: number;
  /** Incidentes concluídos no período sem data de abertura — fora do cálculo. */
  missingCreated: number;
  items: MttrItem[];
}

export const EMPTY_MTTR: MttrResult = {
  count: 0, avg: 0, median: 0, p85: 0, min: 0, max: 0, missingCreated: 0, items: [],
};

const DAY_MS = 86400000;

function ts(value?: string | null): number | null {
  if (!value) return null;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : null;
}

/** Dias corridos entre abertura e conclusão. Datas invertidas ⇒ 0. */
export function resolutionDays(createdIso?: string | null, resolvedIso?: string | null): number | null {
  const a = ts(createdIso);
  const b = ts(resolvedIso);
  if (a === null || b === null) return null;
  return round1(Math.max(0, (b - a) / DAY_MS));
}

export interface MttrOptions {
  /** "YYYY-MM" ou "year-YYYY". Vazio = todos os períodos. */
  periodKey?: string | null;
  squads?: string[];
  clients?: string[];
  /** Incluir cards DeadLetter no MTTR principal. Padrão: false. */
  includeDeadletters?: boolean;
}

/** Incidentes elegíveis ao MTTR, já deduplicados e filtrados. */
export function selectMttrTasks(tasks: MttrTask[], options: MttrOptions = {}): MttrTask[] {
  const squads = options.squads ?? [];
  const clients = options.clients ?? [];
  const includeDl = options.includeDeadletters ?? false;

  return dedupeByTaskCode(
    tasks.filter(t => {
      if (isArchived(t)) return false;
      const dl = isDeadLetter(t);
      if (dl && !includeDl) return false;
      if (!dl && !isIncident(t)) return false;
      return true;
    }) as never[],
  ).filter(t => {
    const squad = (t.squad || "Sem Squad").trim();
    const client = (t.client || "Sem Cliente").trim();
    if (squads.length > 0 && !squads.includes(squad)) return false;
    if (clients.length > 0 && !clients.includes(client)) return false;
    return true;
  }) as MttrTask[];
}

export function buildMttr(tasks: MttrTask[], options: MttrOptions = {}): MttrResult {
  const selected = selectMttrTasks(tasks, options).filter(
    t => !!t.resolved_at && matchesPeriod(t.resolved_at, options.periodKey ?? null),
  );

  const items: MttrItem[] = [];
  let missingCreated = 0;

  for (const t of selected) {
    const days = resolutionDays(t.created_at_yt, t.resolved_at);
    if (days === null) {
      missingCreated += 1;
      continue;
    }
    items.push({
      code: t.task_code,
      title: t.title || "",
      squad: (t.squad || "Sem Squad").trim(),
      client: (t.client || "Sem Cliente").trim(),
      createdAt: t.created_at_yt!,
      resolvedAt: t.resolved_at!,
      days,
      isDeadLetter: isDeadLetter(t),
    });
  }

  if (items.length === 0) return { ...EMPTY_MTTR, missingCreated, items: [] };

  const values = items.map(i => i.days).sort((a, b) => a - b);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;

  return {
    count: items.length,
    avg: round1(avg),
    median: round1(percentile(values, 0.5)),
    p85: round1(percentile(values, 0.85)),
    min: round1(values[0]),
    max: round1(values[values.length - 1]),
    missingCreated,
    items: items.sort((a, b) => b.days - a.days),
  };
}

export interface MttrTrendPoint {
  month: string;
  label: string;
  count: number;
  avg: number;
  median: number;
  p85: number;
}

const MONTHS_PT = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTHS_PT[parseInt(m, 10)] || m}/${(y || "").slice(2)}`;
}

/** Série mensal de MTTR (competência = mês de conclusão), em ordem cronológica. */
export function buildMttrTrend(tasks: MttrTask[], options: MttrOptions = {}): MttrTrendPoint[] {
  const selected = selectMttrTasks(tasks, options).filter(t => !!t.resolved_at);
  const months = new Set<string>();
  for (const t of selected) months.add(t.resolved_at!.slice(0, 7));

  return Array.from(months)
    .sort()
    .map(month => {
      const r = buildMttr(tasks, { ...options, periodKey: month });
      return { month, label: monthLabel(month), count: r.count, avg: r.avg, median: r.median, p85: r.p85 };
    })
    .filter(p => p.count > 0);
}

/** MTTR por squad no período selecionado, do pior para o melhor. */
export function buildMttrBySquad(tasks: MttrTask[], options: MttrOptions = {}): { squad: string; count: number; avg: number; median: number; p85: number }[] {
  const base = buildMttr(tasks, options);
  const map = new Map<string, number[]>();
  for (const i of base.items) {
    if (!map.has(i.squad)) map.set(i.squad, []);
    map.get(i.squad)!.push(i.days);
  }
  return Array.from(map.entries())
    .map(([squad, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        squad,
        count: sorted.length,
        avg: round1(sorted.reduce((s, v) => s + v, 0) / sorted.length),
        median: round1(percentile(sorted, 0.5)),
        p85: round1(percentile(sorted, 0.85)),
      };
    })
    .sort((a, b) => b.avg - a.avg);
}
