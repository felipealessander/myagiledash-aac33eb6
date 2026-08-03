/**
 * Pure metric computations used by the Presentation module.
 * Kept free of React/Supabase so it can be unit-tested.
 *
 * Global rules honoured here:
 *  - tasks with status containing "arquivado" are excluded from every metric
 *  - "Épico" is excluded from flow metrics (Cycle Time / MTTR), but kept for effort
 *  - DeadLetter (DLQ) is identified by tag OR by YouTrack Type
 */

export interface PresentationTask {
  task_code?: string | null;
  title?: string | null;
  category?: string | null;
  squad?: string | null;
  status?: string | null;
  client?: string | null;
  tags?: string[] | null;
  spent_minutes?: number | null;
  estimated_minutes?: number | null;
  interrupted_minutes?: number | null;
  created_at_yt?: string | null;
  started_at?: string | null;
  resolved_at?: string | null;
}

import {
  DEADLETTER_RE,
  
  isArchivedStatus,
  isDeadLetter as ruleIsDeadLetter,
  isIncident as ruleIsIncident,
  isEpic as ruleIsEpic,
} from "./taskRules";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function isArchived(status?: string | null): boolean {
  return isArchivedStatus(status);
}

export function isDeadLetter(t: PresentationTask): boolean {
  return ruleIsDeadLetter(t);
}

export function isIncident(t: PresentationTask): boolean {
  return ruleIsIncident(t);
}

function isEpic(t: PresentationTask): boolean {
  return ruleIsEpic(t);
}

/** Valid, finite timestamp in ms, or null. */
function ts(value?: string | null): number | null {
  if (!value) return null;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : null;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Linear-interpolation-free percentile (nearest-rank), matching the dashboard. */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor(sortedAsc.length * p));
  return sortedAsc[idx];
}

export function median(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  return sortedAsc[Math.floor(sortedAsc.length / 2)];
}

export function squadOf(t: PresentationTask): string {
  return t.squad || "Sem Squad";
}

/**
 * True when the task was CONCLUDED (resolved) inside the given period.
 * periodKey accepts "YYYY-MM" or "year-YYYY". Empty/undefined = no period filter.
 */
export function isResolvedInPeriod(t: PresentationTask, periodKey?: string): boolean {
  if (!periodKey) return true;
  const resolved = ts(t.resolved_at);
  if (resolved === null) return false;
  const d = new Date(resolved);
  const year = String(d.getFullYear());
  const month = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (periodKey.startsWith("year-")) return year === periodKey.replace("year-", "");
  return month === periodKey;
}

/**
 * Filter the raw task list for the presentation:
 *  - drops archived tasks
 *  - keeps only the selected squads (empty selection = all squads)
 *  - keeps only tasks CONCLUDED within the selected period (regardless of when
 *    they were created)
 */
export function filterPresentationTasks(
  tasks: PresentationTask[],
  selectedSquads: string[] = [],
  periodKey?: string,
): PresentationTask[] {
  return tasks.filter(t => {
    if (isArchived(t.status)) return false;
    if (selectedSquads.length > 0 && !selectedSquads.includes(squadOf(t))) return false;
    if (!isResolvedInPeriod(t, periodKey)) return false;
    return true;
  });
}

export interface DistributionStat {
  key: string;
  avg: number;
  median: number;
  p85: number;
  count: number;
}

function statsFrom(key: string, values: number[]): DistributionStat {
  const sorted = values.slice().sort((a, b) => a - b);
  if (sorted.length === 0) return { key, avg: 0, median: 0, p85: 0, count: 0 };
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return {
    key,
    avg: round1(avg),
    median: round1(median(sorted)),
    p85: round1(percentile(sorted, 0.85)),
    count: sorted.length,
  };
}

/**
 * MTTR — Mean Time To Repair, in DAYS.
 * Only incidents that were resolved. Clock = created_at_yt -> resolved_at (calendar
 * elapsed time, NOT hours logged on the card),
 * discounting time parked in "Interrompido".
 * DeadLetter (DLQ) incidents are counted SEPARATELY (deadLetter stat) and are
 * NOT part of the overall / bySquad MTTR.
 */
export interface EffortComparisonRow {
  key: string;
  /** MTTR mediana em dias corridos (relógio de calendário). */
  elapsedDays: number;
  /** Esforço mediano apontado no card, em horas. */
  effortHours: number;
  /** Esforço mediano convertido em dias corridos, para leitura comparável. */
  effortDays: number;
  /** effortHours / (elapsedDays * 24) * 100 — quanto do tempo decorrido foi trabalho efetivo. */
  flowEfficiencyPct: number;
  count: number;
}

export interface IncidentScatterPoint {
  code: string;
  title: string;
  squad: string;
  client: string;
  /** Tempo decorrido até a resolução, em dias corridos. */
  days: number;
  /** Horas apontadas no card. */
  hours: number;
  /** Ponto fora das cercas (IQR) de tempo e/ou esforço. */
  outlier: boolean;
  outlierReason: string;
}

export interface MttrResult {
  overall: DistributionStat;
  bySquad: DistributionStat[];
  resolvedIncidents: number;
  openIncidents: number;
  /** DLQ incidents measured apart from the regular MTTR. */
  deadLetter: DistributionStat;
  resolvedDeadLetterIncidents: number;
  openDeadLetterIncidents: number;
  /** Esforço apontado (horas lançadas) nos incidentes resolvidos — sem DLQ. */
  effort: DistributionStat;
  /** Horas apontadas somadas nos incidentes resolvidos (sem DLQ). */
  totalEffortHours: number;
  /** Incidentes resolvidos sem nenhuma hora apontada. */
  incidentsWithoutEffort: number;
  /** Eficiência de fluxo geral: esforço mediano ÷ tempo decorrido mediano. */
  flowEfficiencyPct: number;
  /** Comparativo tempo decorrido × esforço apontado, por time. */
  effortComparison: EffortComparisonRow[];
  /** Um ponto por incidente resolvido (sem DLQ): MTTR em dias × horas apontadas. */
  scatter: IncidentScatterPoint[];
  /** Cercas superiores (IQR) usadas para marcar outliers. */
  outlierThresholds: { days: number; hours: number };
}

/** Cerca superior de Tukey: Q3 + 1.5 × IQR. Retorna Infinity com amostra insuficiente. */
export function upperFence(values: number[]): number {
  if (values.length < 4) return Infinity;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  return round1(q3 + 1.5 * (q3 - q1));
}


function buildComparisonRow(key: string, days: number[], hours: number[]): EffortComparisonRow {
  const elapsed = statsFrom(key, days).median;
  const effort = statsFrom(key, hours).median;
  return {
    key,
    elapsedDays: elapsed,
    effortHours: effort,
    effortDays: round1(effort / 24),
    flowEfficiencyPct: elapsed > 0 ? round1((effort / (elapsed * 24)) * 100) : 0,
    count: days.length,
  };
}

export function computeMttr(tasks: PresentationTask[]): MttrResult {
  const incidents = tasks.filter(isIncident);
  const perSquad = new Map<string, number[]>();
  const perSquadEffort = new Map<string, number[]>();
  const all: number[] = [];
  const allEffort: number[] = [];
  const dlqValues: number[] = [];
  let openIncidents = 0;
  let openDeadLetterIncidents = 0;
  let totalEffortHours = 0;
  let incidentsWithoutEffort = 0;
  const scatterRaw: Omit<IncidentScatterPoint, "outlier" | "outlierReason">[] = [];

  for (const t of incidents) {
    const dlq = isDeadLetter(t);
    const created = ts(t.created_at_yt);
    const resolved = ts(t.resolved_at);
    if (created === null || resolved === null) {
      if (dlq) openDeadLetterIncidents++;
      else openIncidents++;
      continue;
    }
    const interruptedDays = Math.max(0, (t.interrupted_minutes || 0) / 60 / 24);
    const days = Math.max(0, (resolved - created) / MS_PER_DAY - interruptedDays);
    if (dlq) {
      dlqValues.push(days);
      continue;
    }
    const effortHours = Math.max(0, (t.spent_minutes || 0) / 60);
    if (effortHours === 0) incidentsWithoutEffort++;
    totalEffortHours += effortHours;
    all.push(days);
    allEffort.push(effortHours);
    const s = squadOf(t);
    if (!perSquad.has(s)) perSquad.set(s, []);
    perSquad.get(s)!.push(days);
    if (!perSquadEffort.has(s)) perSquadEffort.set(s, []);
    perSquadEffort.get(s)!.push(effortHours);
    scatterRaw.push({
      code: t.task_code || "—",
      title: t.title || "",
      squad: s,
      client: t.client || "—",
      days: round1(days),
      hours: round1(effortHours),
    });
  }

  const overall = statsFrom("Geral", all);
  const effort = statsFrom("Esforço", allEffort);
  const daysFence = upperFence(all);
  const hoursFence = upperFence(allEffort);
  const scatter: IncidentScatterPoint[] = scatterRaw.map(p => {
    const slowly = p.days > daysFence;
    const heavy = p.hours > hoursFence;
    return {
      ...p,
      outlier: slowly || heavy,
      outlierReason: slowly && heavy
        ? "Tempo e esforço acima do esperado"
        : slowly ? "Tempo decorrido acima do esperado"
          : heavy ? "Esforço apontado acima do esperado"
            : "",
    };
  });

  return {
    overall,
    bySquad: Array.from(perSquad.entries())
      .map(([squad, values]) => statsFrom(squad, values))
      .sort((a, b) => b.median - a.median),
    resolvedIncidents: all.length,
    openIncidents,
    deadLetter: statsFrom("DeadLetter", dlqValues),
    resolvedDeadLetterIncidents: dlqValues.length,
    openDeadLetterIncidents,
    effort,
    totalEffortHours: round1(totalEffortHours),
    incidentsWithoutEffort,
    flowEfficiencyPct: overall.median > 0 ? round1((effort.median / (overall.median * 24)) * 100) : 0,
    effortComparison: Array.from(perSquad.entries())
      .map(([squad, days]) => buildComparisonRow(squad, days, perSquadEffort.get(squad) || []))
      .sort((a, b) => b.elapsedDays - a.elapsedDays),
    scatter,
    outlierThresholds: {
      days: Number.isFinite(daysFence) ? daysFence : 0,
      hours: Number.isFinite(hoursFence) ? hoursFence : 0,
    },
  };
}



/**
 * Cycle Time in DAYS: started_at -> resolved_at, discounting "Interrompido".
 * Excludes Épico (accumulator) and the "Qualidade" squad (different workflow).
 */
export interface CycleTimeResult {
  overall: DistributionStat;
  bySquad: DistributionStat[];
  consideredTasks: number;
  skippedNoDates: number;
}

export function computeCycleTime(tasks: PresentationTask[]): CycleTimeResult {
  const eligible = tasks.filter(
    t => !isEpic(t) && squadOf(t).toLowerCase().trim() !== "qualidade",
  );
  const perSquad = new Map<string, number[]>();
  const all: number[] = [];
  let skippedNoDates = 0;

  for (const t of eligible) {
    const started = ts(t.started_at);
    const resolved = ts(t.resolved_at);
    if (started === null || resolved === null) {
      skippedNoDates++;
      continue;
    }
    const interruptedDays = Math.max(0, (t.interrupted_minutes || 0) / (60 * 24));
    const days = Math.max(0, (resolved - started) / MS_PER_DAY - interruptedDays);
    all.push(days);
    const s = squadOf(t);
    if (!perSquad.has(s)) perSquad.set(s, []);
    perSquad.get(s)!.push(days);
  }

  return {
    overall: statsFrom("Geral", all),
    bySquad: Array.from(perSquad.entries())
      .map(([squad, values]) => statsFrom(squad, values))
      .sort((a, b) => b.median - a.median),
    consideredTasks: all.length,
    skippedNoDates,
  };
}

/**
 * % de apontamento de horas — share of tasks that actually have logged hours
 * (spent_minutes > 0) over all considered tasks.
 */
export interface TimeLoggingRow {
  squad: string;
  total: number;
  withHours: number;
  withoutHours: number;
  pct: number;
  spentHours: number;
}

export interface TimeLoggingResult {
  overallPct: number;
  totalTasks: number;
  tasksWithHours: number;
  tasksWithoutHours: number;
  totalSpentHours: number;
  bySquad: TimeLoggingRow[];
}

export function computeTimeLogging(tasks: PresentationTask[]): TimeLoggingResult {
  const perSquad = new Map<string, { total: number; withHours: number; spentHours: number }>();
  let total = 0;
  let withHours = 0;
  let spentHours = 0;

  for (const t of tasks) {
    const minutes = t.spent_minutes || 0;
    const s = squadOf(t);
    const entry = perSquad.get(s) || { total: 0, withHours: 0, spentHours: 0 };
    entry.total += 1;
    total += 1;
    if (minutes > 0) {
      entry.withHours += 1;
      withHours += 1;
    }
    entry.spentHours += minutes / 60;
    spentHours += minutes / 60;
    perSquad.set(s, entry);
  }

  const bySquad: TimeLoggingRow[] = Array.from(perSquad.entries())
    .map(([squad, e]) => ({
      squad,
      total: e.total,
      withHours: e.withHours,
      withoutHours: e.total - e.withHours,
      pct: e.total > 0 ? round1((e.withHours / e.total) * 100) : 0,
      spentHours: round1(e.spentHours),
    }))
    .sort((a, b) => b.pct - a.pct);

  return {
    overallPct: total > 0 ? round1((withHours / total) * 100) : 0,
    totalTasks: total,
    tasksWithHours: withHours,
    tasksWithoutHours: total - withHours,
    totalSpentHours: round1(spentHours),
    bySquad,
  };
}

/** DLQ — DeadLetter volume and effort. */
export interface DlqRow {
  key: string;
  count: number;
  hours: number;
}

export type DlqMatch = "tag" | "tipo" | "tag+tipo";

export interface DlqItem {
  taskCode: string;
  title: string;
  squad: string;
  client: string;
  status: string;
  hours: number;
  matchedBy: DlqMatch;
  matchedValue: string;
}

export interface DlqResult {
  count: number;
  hours: number;
  sharePct: number;
  hoursSharePct: number;
  bySquad: DlqRow[];
  byClient: DlqRow[];
  items: DlqItem[];
}

/** How a task was identified as DeadLetter (null when it is not). */
export function deadLetterMatch(t: PresentationTask): { matchedBy: DlqMatch; matchedValue: string } | null {
  const tag = (t.tags || []).find(tag => DEADLETTER_RE.test(tag || ""));
  const byType = !!(t.category && DEADLETTER_RE.test(t.category));
  if (tag && byType) return { matchedBy: "tag+tipo", matchedValue: `${t.category} · ${tag}` };
  if (tag) return { matchedBy: "tag", matchedValue: tag };
  if (byType) return { matchedBy: "tipo", matchedValue: t.category as string };
  return null;
}

export function computeDlq(tasks: PresentationTask[]): DlqResult {
  const dlq = tasks.filter(isDeadLetter);
  const totalHours = tasks.reduce((s, t) => s + (t.spent_minutes || 0) / 60, 0);
  const dlqHours = dlq.reduce((s, t) => s + (t.spent_minutes || 0) / 60, 0);

  const group = (pick: (t: PresentationTask) => string): DlqRow[] => {
    const map = new Map<string, { count: number; hours: number }>();
    for (const t of dlq) {
      const k = pick(t);
      const e = map.get(k) || { count: 0, hours: 0 };
      e.count += 1;
      e.hours += (t.spent_minutes || 0) / 60;
      map.set(k, e);
    }
    return Array.from(map.entries())
      .map(([key, e]) => ({ key, count: e.count, hours: round1(e.hours) }))
      .sort((a, b) => b.count - a.count || b.hours - a.hours);
  };

  const items: DlqItem[] = dlq
    .map(t => {
      const m = deadLetterMatch(t)!;
      return {
        taskCode: t.task_code || "—",
        title: t.title || "(sem título)",
        squad: squadOf(t),
        client: t.client || "Sem Cliente",
        status: t.status || "—",
        hours: round1((t.spent_minutes || 0) / 60),
        matchedBy: m.matchedBy,
        matchedValue: m.matchedValue,
      };
    })
    .sort((a, b) => b.hours - a.hours || a.taskCode.localeCompare(b.taskCode));

  return {
    count: dlq.length,
    hours: round1(dlqHours),
    sharePct: tasks.length > 0 ? round1((dlq.length / tasks.length) * 100) : 0,
    hoursSharePct: totalHours > 0 ? round1((dlqHours / totalHours) * 100) : 0,
    bySquad: group(squadOf),
    byClient: group(t => t.client || "Sem Cliente"),
    items,
  };
}


export interface PresentationMetrics {
  monthLabel: string;
  squads: string[];
  taskCount: number;
  mttr: MttrResult;
  cycleTime: CycleTimeResult;
  timeLogging: TimeLoggingResult;
  dlq: DlqResult;
}

export function buildPresentationMetrics(
  rawTasks: PresentationTask[],
  options: { monthLabel: string; selectedSquads?: string[]; periodKey?: string },
): PresentationMetrics {
  const selectedSquads = options.selectedSquads ?? [];
  const tasks = filterPresentationTasks(rawTasks, selectedSquads, options.periodKey);
  const squads =
    selectedSquads.length > 0
      ? selectedSquads.slice().sort()
      : Array.from(new Set(tasks.map(squadOf))).sort();

  return {
    monthLabel: options.monthLabel,
    squads,
    taskCount: tasks.length,
    mttr: computeMttr(tasks),
    cycleTime: computeCycleTime(tasks),
    timeLogging: computeTimeLogging(tasks),
    dlq: computeDlq(tasks),
  };
}
