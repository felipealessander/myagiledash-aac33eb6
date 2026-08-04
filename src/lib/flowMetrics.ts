/**
 * Flow metrics (Lead Time / Cycle Time) — Portal de Indicadores Attus.
 *
 * Regras de negócio acordadas:
 *  - Lead Time  = dias ÚTEIS entre a criação (created_at_yt) e a conclusão (resolved_at).
 *  - Cycle Time = dias ÚTEIS entre o início efetivo do desenvolvimento (started_at) e a
 *                 conclusão. Quando não há data de início, usa-se a data de criação.
 *  - Itens arquivados nunca entram em nenhum cálculo.
 *  - Épicos e a squad "Qualidade" ficam fora das métricas de fluxo.
 *  - Incidentes (o tipo "Bug" do YouTrack é o mesmo que Incidente) e DeadLetter
 *    NÃO entram nos indicadores gerais:
 *    são contabilizados e apresentados separadamente.
 *  - "Sob Demanda" = itens com cliente vinculado.
 *  - Um mesmo task_code aparece uma única vez (mudanças de status/squad não duplicam).
 *  - O período é definido pela data de CONCLUSÃO (independente de quando foi aberto).
 */

export interface FlowTask {
  task_code: string;
  title?: string | null;
  category?: string | null;
  squad?: string | null;
  status?: string | null;
  client?: string | null;
  created_at_yt?: string | null;
  started_at?: string | null;
  resolved_at?: string | null;
  tags?: string[] | null;
  spent_minutes?: number | null;
  interrupted_minutes?: number | null;
}

export type FlowSegmentKey = "demands" | "onDemand" | "incidents";

import {
  isArchived as ruleIsArchived,
  isDeadLetter as ruleIsDeadLetter,
  isIncident as ruleIsIncident,
  isEpic as ruleIsEpic,
  isQualidadeSquad as ruleIsQualidadeSquad,
} from "./taskRules";

export function isArchivedTask(t: FlowTask): boolean {
  return ruleIsArchived(t);
}

export function isDeadLetterTask(t: FlowTask): boolean {
  return ruleIsDeadLetter(t);
}

/** Incidente (inclui o tipo "Bug" do YouTrack, que é a mesma coisa). */
export function isPureIncidentTask(t: FlowTask): boolean {
  return ruleIsIncident(t);
}

/** Incidente e DeadLetter compõem a visão separada de incidentes. */
export function isIncidentTask(t: FlowTask): boolean {
  return isDeadLetterTask(t) || isPureIncidentTask(t);
}

export type FlowTaskClass = "regular" | "deadletter" | "incident";

/**
 * Classificação principal de um card (para rótulos e detalhamento).
 * DeadLetter tem precedência sobre Incidente quando o card tem as duas marcações.
 */
export function classifyFlowTask(t: FlowTask): FlowTaskClass {
  if (isDeadLetterTask(t)) return "deadletter";
  if (isPureIncidentTask(t)) return "incident";
  return "regular";
}

export interface FlowInclusion {
  /** Incluir Incidentes (tipo Incidente/Bug) nos indicadores gerais. Padrão: false. */
  incidents?: boolean;
  /** Incluir cards DeadLetter nos indicadores gerais. Padrão: false. */
  deadletters?: boolean;
}

export const DEFAULT_INCLUSION: Required<FlowInclusion> = { incidents: false, deadletters: false };

/**
 * Um card entra nos indicadores gerais quando é uma demanda regular ou quando
 * a opção correspondente à sua classificação está ativa. Cards com mais de uma
 * classificação entram uma única vez (a deduplicação por task_code garante isso).
 * Incidentes "puros" nunca entram.
 */
export function isIncludedInGeneral(t: FlowTask, inclusion: FlowInclusion = {}): boolean {
  const includeIncidents = inclusion.incidents ?? DEFAULT_INCLUSION.incidents;
  const includeDl = inclusion.deadletters ?? DEFAULT_INCLUSION.deadletters;
  switch (classifyFlowTask(t)) {
    case "regular":
      return true;
    case "deadletter":
      return includeDl;
    case "incident":
      return includeIncidents;
    default:
      return false;
  }
}


export function isEpicTask(t: FlowTask): boolean {
  return ruleIsEpic(t);
}

export function isQualidadeSquad(t: FlowTask): boolean {
  return ruleIsQualidadeSquad(t.squad);
}

/** "Sob Demanda" = item com cliente vinculado. */
export function isOnDemandTask(t: FlowTask): boolean {
  return !!(t.client && t.client.trim().length > 0);
}

export function squadOf(t: FlowTask): string {
  return t.squad && t.squad.trim() ? t.squad.trim() : "Sem Squad";
}

export function clientOf(t: FlowTask): string {
  return t.client && t.client.trim() ? t.client.trim() : "Sem Cliente";
}

/* ────────────────────────── datas ────────────────────────── */

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const DAY_MS = 86400000;

/**
 * Dias úteis (seg–sex) decorridos entre duas datas.
 * Mesmo dia = 0. Sexta → segunda = 1. Datas retroativas (fim < início) = 0.
 */
export function businessDaysBetween(start: Date, end: Date): number {
  let cursor = startOfUtcDay(start);
  const target = startOfUtcDay(end);
  if (target <= cursor) return 0;
  let days = 0;
  while (cursor < target) {
    cursor += DAY_MS;
    const dow = new Date(cursor).getUTCDay();
    if (dow !== 0 && dow !== 6) days += 1;
  }
  return days;
}

/** Mês "YYYY-MM" de uma data ISO. */
export function monthKeyOf(iso?: string | null): string | null {
  if (!iso) return null;
  const d = parseDate(iso);
  return d ? iso.slice(0, 7) : null;
}

/** Aceita "YYYY-MM" ou "year-YYYY". Sem chave = aceita tudo. */
export function matchesPeriod(iso: string | null | undefined, periodKey?: string | null): boolean {
  if (!periodKey) return true;
  const key = monthKeyOf(iso);
  if (!key) return false;
  if (periodKey.startsWith("year-")) return key.startsWith(periodKey.replace("year-", ""));
  return key === periodKey;
}

/* ────────────────────────── estatística ────────────────────────── */

/** Percentil por nearest-rank sobre a lista ordenada. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface FlowStats {
  count: number;
  avg: number;
  median: number;
  p85: number;
  min: number;
  max: number;
}

export const EMPTY_STATS: FlowStats = { count: 0, avg: 0, median: 0, p85: 0, min: 0, max: 0 };

export function computeStats(values: number[]): FlowStats {
  if (values.length === 0) return { ...EMPTY_STATS };
  const sorted = [...values].sort((a, b) => a - b);
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return {
    count: sorted.length,
    avg: round1(avg),
    median: round1(percentile(sorted, 0.5)),
    p85: round1(percentile(sorted, 0.85)),
    min: round1(sorted[0]),
    max: round1(sorted[sorted.length - 1]),
  };
}

/* ────────────────────────── normalização ────────────────────────── */

/**
 * Remove duplicidades de task_code (mudança de status, squad ou reimportação).
 * Mantém o registro mais "completo": prioriza o que tem conclusão e, em empate,
 * a conclusão/início mais recentes — refletindo o estado final do card.
 */
export function dedupeByTaskCode(tasks: FlowTask[]): FlowTask[] {
  const score = (t: FlowTask) => {
    const resolved = parseDate(t.resolved_at)?.getTime() ?? -1;
    const started = parseDate(t.started_at)?.getTime() ?? -1;
    return resolved * 10 + (started > 0 ? 1 : 0);
  };
  const map = new Map<string, FlowTask>();
  for (const t of tasks) {
    const key = t.task_code || `${t.title}-${t.created_at_yt}`;
    const current = map.get(key);
    if (!current || score(t) > score(current)) map.set(key, t);
  }
  return Array.from(map.values());
}

export interface FlowFilters {
  periodKey?: string | null;
  squads?: string[];
  clients?: string[];
  /** Tipos opcionalmente incluídos nos indicadores gerais (Incidente / DeadLetter). */
  inclusion?: FlowInclusion;
}

/** Aplica os filtros globais do portal (arquivados, squad, cliente). */
export function applyFlowFilters(tasks: FlowTask[], filters: FlowFilters = {}): FlowTask[] {
  const squads = filters.squads ?? [];
  const clients = filters.clients ?? [];
  return dedupeByTaskCode(tasks.filter(t => !isArchivedTask(t)))
    .filter(t => (squads.length === 0 ? true : squads.includes(squadOf(t))))
    .filter(t => (clients.length === 0 ? true : clients.includes(clientOf(t))));
}

/** Itens elegíveis a métricas de fluxo (fora: épicos e squad Qualidade). */
export function isFlowEligible(t: FlowTask): boolean {
  return !isEpicTask(t) && !isQualidadeSquad(t);
}

export function segmentOf(t: FlowTask): FlowSegmentKey {
  if (isIncidentTask(t)) return "incidents";
  return isOnDemandTask(t) ? "onDemand" : "demands";
}

/* ────────────────────────── cálculo ────────────────────────── */

export interface FlowItemDetail {
  code: string;
  title: string;
  squad: string;
  client: string;
  type: FlowTaskClass;
  category: string;
  /** Data de abertura (created_at_yt). */
  createdAt: string | null;
  /** Data de início do desenvolvimento (started_at). */
  startedAt: string | null;
  resolvedAt: string | null;
  lead: number | null;
  cycle: number | null;
  hours: number;
  isDeadletter: boolean;
  isIncident: boolean;
  /** Motivo pelo qual o card entrou no indicador. */
  inclusionReason: string;
  /** Inconsistências de dados detectadas neste card. */
  issues: string[];
}

/** Inconsistência de dados que não deve ser silenciosamente incorporada. */
export interface FlowDataIssue {
  code: string;
  squad: string;
  kind:
    | "resolved_before_created"
    | "started_before_created"
    | "resolved_without_created"
    | "resolved_without_started"
    | "missing_squad"
    | "invalid_classification";
  message: string;
}

const ISSUE_MESSAGE: Record<FlowDataIssue["kind"], string> = {
  resolved_before_created: "Data de fechamento anterior à data de abertura",
  started_before_created: "Início do desenvolvimento anterior à abertura",
  resolved_without_created: "Concluído sem data de abertura (fora do Lead Time)",
  resolved_without_started: "Concluído sem data de início (Cycle Time usa a abertura)",
  missing_squad: "Card sem squad",
  invalid_classification: "Card sem tipo/classificação",
};

/** Detecta inconsistências de um card já filtrado. */
export function detectTaskIssues(t: FlowTask): FlowDataIssue["kind"][] {
  const kinds: FlowDataIssue["kind"][] = [];
  const created = parseDate(t.created_at_yt);
  const started = parseDate(t.started_at);
  const resolved = parseDate(t.resolved_at);
  if (created && resolved && resolved.getTime() < created.getTime()) kinds.push("resolved_before_created");
  if (created && started && started.getTime() < created.getTime()) kinds.push("started_before_created");
  if (resolved && !created) kinds.push("resolved_without_created");
  if (resolved && !started) kinds.push("resolved_without_started");
  if (!t.squad || !t.squad.trim()) kinds.push("missing_squad");
  if (!t.category || !t.category.trim()) kinds.push("invalid_classification");
  return kinds;
}

export function describeIssue(kind: FlowDataIssue["kind"]): string {
  return ISSUE_MESSAGE[kind];
}

function inclusionReasonOf(t: FlowTask, key: FlowSegmentKey): string {
  const type = classifyFlowTask(t);
  if (key === "incidents") return `Visão separada de incidentes (${type})`;
  const base =
    type === "regular"
      ? "Demanda regular"
      : type === "deadletter"
        ? "DeadLetter incluído por filtro"
        : "Incidente incluído por filtro";
  return isOnDemandTask(t) ? `${base} · Sob Demanda (cliente vinculado)` : base;
}

export interface FlowSegmentResult {
  key: FlowSegmentKey;
  /** Itens concluídos no período (base dos indicadores). */
  completed: number;
  /** Itens ainda abertos criados no período. */
  open: number;
  /** Concluídos sem data de início — Cycle Time usa a data de criação. */
  missingStart: number;
  /** Concluídos sem data de criação — ficam fora do Lead Time. */
  missingCreated: number;
  /** Itens reabertos / com retorno de QA. */
  reopened: number;
  /** Concluídos por classificação de card. */
  byType: Record<FlowTaskClass, number>;
  leadTime: FlowStats;
  cycleTime: FlowStats;
  bySquad: { squad: string; count: number; leadMedian: number; leadP85: number; cycleMedian: number; cycleP85: number }[];
  byClient: { client: string; count: number; leadMedian: number; cycleMedian: number }[];
  /** Cards que compõem o resultado (concluídos no período). */
  items: FlowItemDetail[];
  /** Inconsistências detectadas entre os cards do período. */
  issues: FlowDataIssue[];
}


function emptySegment(key: FlowSegmentKey): FlowSegmentResult {
  return {
    key,
    completed: 0,
    open: 0,
    missingStart: 0,
    missingCreated: 0,
    reopened: 0,
    byType: { regular: 0, deadletter: 0, incident: 0 },
    leadTime: { ...EMPTY_STATS },
    cycleTime: { ...EMPTY_STATS },
    bySquad: [],
    byClient: [],
    items: [],
    issues: [],

  };
}

function isReopened(t: FlowTask): boolean {
  const tags = (t.tags || []).map(x => (x || "").toLowerCase());
  return tags.some(x => x.includes("reabert") || x.includes("retorno") || x.includes("corrigir"));
}

export function computeSegment(tasks: FlowTask[], key: FlowSegmentKey, periodKey?: string | null): FlowSegmentResult {
  const eligible = tasks.filter(isFlowEligible);
  const result = emptySegment(key);

  const completed = eligible.filter(t => t.resolved_at && matchesPeriod(t.resolved_at, periodKey));
  result.completed = completed.length;
  result.open = eligible.filter(t => !t.resolved_at && matchesPeriod(t.created_at_yt, periodKey)).length;
  result.reopened = completed.filter(isReopened).length;

  const leadValues: number[] = [];
  const cycleValues: number[] = [];
  const perSquad = new Map<string, { lead: number[]; cycle: number[]; count: number }>();
  const perClient = new Map<string, { lead: number[]; cycle: number[]; count: number }>();

  for (const t of completed) {
    const resolved = parseDate(t.resolved_at)!;
    const created = parseDate(t.created_at_yt);
    const started = parseDate(t.started_at);
    if (!started) result.missingStart += 1;
    if (!created) result.missingCreated += 1;

    const lead = created ? businessDaysBetween(created, resolved) : null;
    const cycleStart = started ?? created;
    const cycle = cycleStart ? businessDaysBetween(cycleStart, resolved) : null;

    if (lead !== null) leadValues.push(lead);
    if (cycle !== null) cycleValues.push(cycle);

    const sq = squadOf(t);
    if (!perSquad.has(sq)) perSquad.set(sq, { lead: [], cycle: [], count: 0 });
    const sEntry = perSquad.get(sq)!;
    sEntry.count += 1;
    if (lead !== null) sEntry.lead.push(lead);
    if (cycle !== null) sEntry.cycle.push(cycle);

    const cl = clientOf(t);
    if (!perClient.has(cl)) perClient.set(cl, { lead: [], cycle: [], count: 0 });
    const cEntry = perClient.get(cl)!;
    cEntry.count += 1;
    if (lead !== null) cEntry.lead.push(lead);
    if (cycle !== null) cEntry.cycle.push(cycle);

    const type = classifyFlowTask(t);
    result.byType[type] += 1;
    const issueKinds = detectTaskIssues(t);
    for (const kind of issueKinds) {
      result.issues.push({ code: t.task_code, squad: sq, kind, message: describeIssue(kind) });
    }
    result.items.push({
      code: t.task_code,
      title: t.title || "",
      squad: sq,
      client: cl,
      type,
      category: t.category || "—",
      createdAt: t.created_at_yt ?? null,
      startedAt: t.started_at ?? null,
      resolvedAt: t.resolved_at ?? null,
      lead,
      cycle,
      hours: Math.round(((t.spent_minutes || 0) / 60) * 10) / 10,
      isDeadletter: isDeadLetterTask(t),
      isIncident: isPureIncidentTask(t),
      inclusionReason: inclusionReasonOf(t, key),
      issues: issueKinds.map(describeIssue),
    });
  }


  result.items.sort((a, b) => (b.lead ?? -1) - (a.lead ?? -1) || a.code.localeCompare(b.code));

  result.leadTime = computeStats(leadValues);
  result.cycleTime = computeStats(cycleValues);

  result.bySquad = Array.from(perSquad.entries())
    .map(([squad, v]) => ({
      squad,
      count: v.count,
      leadMedian: round1(percentile(v.lead, 0.5)),
      leadP85: round1(percentile(v.lead, 0.85)),
      cycleMedian: round1(percentile(v.cycle, 0.5)),
      cycleP85: round1(percentile(v.cycle, 0.85)),
    }))
    .sort((a, b) => b.count - a.count || a.squad.localeCompare(b.squad));

  result.byClient = Array.from(perClient.entries())
    .map(([client, v]) => ({
      client,
      count: v.count,
      leadMedian: round1(percentile(v.lead, 0.5)),
      cycleMedian: round1(percentile(v.cycle, 0.5)),
    }))
    .sort((a, b) => b.count - a.count || a.client.localeCompare(b.client));

  return result;
}

export interface FlowMetricsResult {
  periodKey: string | null;
  /** Configuração de inclusão aplicada a este resultado. */
  inclusion: Required<FlowInclusion>;
  /** Indicadores gerais: demandas regulares (+ Incidente/DeadLetter quando incluídos). */
  general: FlowSegmentResult;
  /** Somente demandas sem cliente vinculado. */
  demands: FlowSegmentResult;
  /** Somente itens com cliente vinculado (Sob Demanda). */
  onDemand: FlowSegmentResult;
  /** Incidente e DeadLetter — contabilizados à parte, sempre completos. */
  incidents: FlowSegmentResult;
  squads: string[];
  clients: string[];
}

export function buildFlowMetrics(rawTasks: FlowTask[], filters: FlowFilters = {}): FlowMetricsResult {
  const tasks = applyFlowFilters(rawTasks, filters);
  const periodKey = filters.periodKey ?? null;
  const inclusion: Required<FlowInclusion> = {
    incidents: filters.inclusion?.incidents ?? DEFAULT_INCLUSION.incidents,
    deadletters: filters.inclusion?.deadletters ?? DEFAULT_INCLUSION.deadletters,
  };

  const incidentTasks = tasks.filter(isIncidentTask);
  const generalTasks = tasks.filter(t => isIncludedInGeneral(t, inclusion));
  const onDemandTasks = generalTasks.filter(isOnDemandTask);
  const plainTasks = generalTasks.filter(t => !isOnDemandTask(t));

  return {
    periodKey,
    inclusion,
    general: computeSegment(generalTasks, "demands", periodKey),
    demands: computeSegment(plainTasks, "demands", periodKey),
    onDemand: computeSegment(onDemandTasks, "onDemand", periodKey),
    incidents: computeSegment(incidentTasks, "incidents", periodKey),
    squads: Array.from(new Set(tasks.map(squadOf))).sort(),
    clients: Array.from(new Set(tasks.filter(isOnDemandTask).map(clientOf))).sort(),
  };
}

/* ────────────────────────── comparação mensal ────────────────────────── */

export interface FlowPeriodComparison {
  periodKey: string;
  label: string;
  metrics: FlowMetricsResult;
}

/**
 * Compara até 3 períodos. Meses sem registros retornam um resultado zerado
 * (e não são omitidos) para manter a leitura de evolução.
 */
export function buildFlowComparison(
  tasksByPeriod: Record<string, FlowTask[]>,
  periods: { value: string; label: string }[],
  filters: Omit<FlowFilters, "periodKey"> = {},
  maxPeriods = 3,
): FlowPeriodComparison[] {
  return periods.slice(0, maxPeriods).map(p => ({
    periodKey: p.value,
    label: p.label,
    metrics: buildFlowMetrics(tasksByPeriod[p.value] || [], { ...filters, periodKey: p.value }),
  }));
}

export type FlowMetricKind = "lead" | "cycle";

export interface ComparisonChartRow {
  label: string;
  periodKey: string;
  media: number;
  mediana: number;
  p85: number;
  volume: number;
}

/** Série pronta para o gráfico de comparação mensal. */
export function toComparisonChartData(
  comparison: FlowPeriodComparison[],
  segment: "general" | "demands" | "onDemand" | "incidents",
  metric: FlowMetricKind,
): ComparisonChartRow[] {
  return comparison.map(c => {
    const seg = c.metrics[segment];
    const stats = metric === "lead" ? seg.leadTime : seg.cycleTime;
    return {
      label: c.label,
      periodKey: c.periodKey,
      media: stats.avg,
      mediana: stats.median,
      p85: stats.p85,
      volume: seg.completed,
    };
  });
}

/** Variação absoluta e percentual entre dois valores (protegida contra divisão por zero). */
export function computeVariation(current: number, previous: number): { abs: number; pct: number | null } {
  const abs = round1(current - previous);
  if (!previous) return { abs, pct: null };
  return { abs, pct: Math.round(((current - previous) / previous) * 1000) / 10 };
}


/* ────────────────────────── histórico Sob Demanda ────────────────────────── */

export interface OnDemandHistoryPoint {
  periodKey: string;
  label: string;
  completed: number;
  open: number;
  clients: number;
  hours: number;
  leadMedian: number;
  leadP85: number;
  cycleMedian: number;
  cycleP85: number;
}

/** Evolução mês a mês dos itens Sob Demanda (cliente vinculado). */
export function buildOnDemandHistory(
  tasksByPeriod: Record<string, FlowTask[]>,
  periods: { value: string; label: string }[],
  filters: Omit<FlowFilters, "periodKey"> = {},
): OnDemandHistoryPoint[] {
  return periods
    .slice()
    .sort((a, b) => a.value.localeCompare(b.value))
    .map(p => {
      const metrics = buildFlowMetrics(tasksByPeriod[p.value] || [], { ...filters, periodKey: p.value });
      const seg = metrics.onDemand;
      const monthTasks = applyFlowFilters(tasksByPeriod[p.value] || [], filters)
        .filter(t => isFlowEligible(t) && isIncludedInGeneral(t, metrics.inclusion) && isOnDemandTask(t) && matchesPeriod(t.resolved_at, p.value));
      return {
        periodKey: p.value,
        label: p.label,
        completed: seg.completed,
        open: seg.open,
        clients: new Set(monthTasks.map(clientOf)).size,
        hours: Math.round(monthTasks.reduce((s, t) => s + (t.spent_minutes || 0) / 60, 0) * 10) / 10,
        leadMedian: seg.leadTime.median,
        leadP85: seg.leadTime.p85,
        cycleMedian: seg.cycleTime.median,
        cycleP85: seg.cycleTime.p85,
      };
    });
}
