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

const DEADLETTER_RE = /dead[\s-]?letter/i;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_HOUR = 1000 * 60 * 60;

export function isArchived(status?: string | null): boolean {
  return (status || "").toLowerCase().trim().includes("arquivado");
}

export function isDeadLetter(t: PresentationTask): boolean {
  if ((t.tags || []).some(tag => DEADLETTER_RE.test(tag || ""))) return true;
  if (t.category && DEADLETTER_RE.test(t.category)) return true;
  return false;
}

export function isIncident(t: PresentationTask): boolean {
  return (t.category || "").toLowerCase().trim() === "incidente";
}

function isEpic(t: PresentationTask): boolean {
  return (t.category || "").toLowerCase().trim() === "épico";
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
 * Filter the raw task list for the presentation:
 *  - drops archived tasks
 *  - keeps only the selected squads (empty selection = all squads)
 */
export function filterPresentationTasks(
  tasks: PresentationTask[],
  selectedSquads: string[] = [],
): PresentationTask[] {
  return tasks.filter(t => {
    if (isArchived(t.status)) return false;
    if (selectedSquads.length > 0 && !selectedSquads.includes(squadOf(t))) return false;
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
 * MTTR — Mean Time To Repair, in HOURS.
 * Only incidents that were resolved. Clock = created_at_yt -> resolved_at,
 * discounting time parked in "Interrompido".
 * DeadLetter (DLQ) incidents are counted SEPARATELY (deadLetter stat) and are
 * NOT part of the overall / bySquad MTTR.
 */
export interface MttrResult {
  overall: DistributionStat;
  bySquad: DistributionStat[];
  resolvedIncidents: number;
  openIncidents: number;
  /** DLQ incidents measured apart from the regular MTTR. */
  deadLetter: DistributionStat;
  resolvedDeadLetterIncidents: number;
  openDeadLetterIncidents: number;
}

export function computeMttr(tasks: PresentationTask[]): MttrResult {
  const incidents = tasks.filter(isIncident);
  const perSquad = new Map<string, number[]>();
  const all: number[] = [];
  const dlqValues: number[] = [];
  let openIncidents = 0;
  let openDeadLetterIncidents = 0;

  for (const t of incidents) {
    const dlq = isDeadLetter(t);
    const created = ts(t.created_at_yt);
    const resolved = ts(t.resolved_at);
    if (created === null || resolved === null) {
      if (dlq) openDeadLetterIncidents++;
      else openIncidents++;
      continue;
    }
    const interruptedHours = Math.max(0, (t.interrupted_minutes || 0) / 60);
    const hours = Math.max(0, (resolved - created) / MS_PER_HOUR - interruptedHours);
    if (dlq) {
      dlqValues.push(hours);
      continue;
    }
    all.push(hours);
    const s = squadOf(t);
    if (!perSquad.has(s)) perSquad.set(s, []);
    perSquad.get(s)!.push(hours);
  }

  return {
    overall: statsFrom("Geral", all),
    bySquad: Array.from(perSquad.entries())
      .map(([squad, values]) => statsFrom(squad, values))
      .sort((a, b) => b.median - a.median),
    resolvedIncidents: all.length,
    openIncidents,
    deadLetter: statsFrom("DeadLetter", dlqValues),
    resolvedDeadLetterIncidents: dlqValues.length,
    openDeadLetterIncidents,
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

export interface DlqResult {
  count: number;
  hours: number;
  sharePct: number;
  hoursSharePct: number;
  bySquad: DlqRow[];
  byClient: DlqRow[];
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

  return {
    count: dlq.length,
    hours: round1(dlqHours),
    sharePct: tasks.length > 0 ? round1((dlq.length / tasks.length) * 100) : 0,
    hoursSharePct: totalHours > 0 ? round1((dlqHours / totalHours) * 100) : 0,
    bySquad: group(squadOf),
    byClient: group(t => t.client || "Sem Cliente"),
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
  options: { monthLabel: string; selectedSquads?: string[] },
): PresentationMetrics {
  const selectedSquads = options.selectedSquads ?? [];
  const tasks = filterPresentationTasks(rawTasks, selectedSquads);
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
