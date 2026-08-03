// Pure helpers for computing client usage (planned vs realized hours per month).
// Extracted so we can unit-test the logic independently of Supabase.

export interface ClientLite {
  id: string;
  name: string;
  active: boolean;
  aliases: string[];
}

export interface TaskLite {
  client: string | null;
  spent_minutes: number | null;
  status: string | null;
  resolved_at: string | null;
  created_at_yt: string | null;
}

export interface MonthlyHoursLite {
  client_id: string;
  month: string; // YYYY-MM
  contracted_hours: number;
}

export interface ClientUsageRow {
  clientId: string;
  clientName: string;
  contractedHours: number;
  spentHours: number;
  taskCount: number;
  utilizationPct: number;
}

export interface UsageResult {
  usage: ClientUsageRow[];
  unmapped: { alias: string; spentHours: number; taskCount: number }[];
}

import { isArchivedStatus } from "./taskRules";

/**
 * Return the month bucket (YYYY-MM, UTC) a task should be attributed to.
 * Rule: use resolved_at if present; otherwise created_at_yt.
 * Returns null when neither date is available.
 */
export function taskMonthBucket(task: TaskLite): string | null {
  const iso = task.resolved_at ?? task.created_at_yt;
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Build a normalized alias -> client map (uppercased, trimmed).
 * Includes the client name itself as an implicit alias.
 */
export function buildAliasMap(clients: ClientLite[]): Map<string, ClientLite> {
  const map = new Map<string, ClientLite>();
  for (const c of clients) {
    if (!c.active) continue;
    const add = (raw: string) => {
      const k = raw.trim().toUpperCase();
      if (k) map.set(k, c);
    };
    add(c.name);
    for (const a of c.aliases || []) add(a);
  }
  return map;
}

/**
 * Compute usage for a single month given:
 * - all clients (active filter applied internally)
 * - all tasks (any month — function filters by bucket)
 * - all monthly hour targets
 *
 * Tasks with status "arquivado" are excluded.
 */
export function computeClientUsage(
  month: string,
  clients: ClientLite[],
  tasks: TaskLite[],
  hours: MonthlyHoursLite[]
): UsageResult {
  const aliasMap = buildAliasMap(clients);
  const activeClients = clients.filter(c => c.active);

  const perClient = new Map<string, { spent: number; tasks: number }>();
  const unmapped = new Map<string, { spent: number; tasks: number }>();

  for (const t of tasks) {
    if (isArchivedStatus(t.status)) continue;
    if (taskMonthBucket(t) !== month) continue;
    const key = String(t.client || "").trim().toUpperCase();
    if (!key) continue;
    const spentH = (t.spent_minutes || 0) / 60;
    const c = aliasMap.get(key);
    if (c) {
      const cur = perClient.get(c.id) || { spent: 0, tasks: 0 };
      cur.spent += spentH;
      cur.tasks += 1;
      perClient.set(c.id, cur);
    } else {
      const cur = unmapped.get(key) || { spent: 0, tasks: 0 };
      cur.spent += spentH;
      cur.tasks += 1;
      unmapped.set(key, cur);
    }
  }

  const hoursForMonth = hours.filter(h => h.month === month);

  const usage: ClientUsageRow[] = activeClients.map(c => {
    const h = hoursForMonth.find(x => x.client_id === c.id);
    const contracted = h?.contracted_hours || 0;
    const u = perClient.get(c.id) || { spent: 0, tasks: 0 };
    const spentRounded = Math.round(u.spent * 10) / 10;
    return {
      clientId: c.id,
      clientName: c.name,
      contractedHours: contracted,
      spentHours: spentRounded,
      taskCount: u.tasks,
      utilizationPct: contracted > 0 ? Math.round((u.spent / contracted) * 1000) / 10 : 0,
    };
  });

  return {
    usage,
    unmapped: Array.from(unmapped.entries())
      .map(([alias, v]) => ({ alias, spentHours: Math.round(v.spent * 10) / 10, taskCount: v.tasks }))
      .sort((a, b) => b.spentHours - a.spentHours),
  };
}
