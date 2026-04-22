import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Client {
  id: string;
  name: string;
  classification: string;
  active: boolean;
  aliases: string[];
}

export interface ClientMonthlyHours {
  id: string;
  client_id: string;
  month: string; // YYYY-MM
  contracted_hours: number;
}

export interface ClientUsage {
  client: Client;
  contractedHours: number;
  spentHours: number;
  taskCount: number;
  utilizationPct: number;
  unmappedAlias?: string;
}

const STATUS_ARQUIVADO = "arquivado";

export function useClientsData(month: string | null) {
  const [clients, setClients] = useState<Client[]>([]);
  const [hours, setHours] = useState<ClientMonthlyHours[]>([]);
  const [usage, setUsage] = useState<ClientUsage[]>([]);
  const [unmappedClients, setUnmappedClients] = useState<{ alias: string; spentHours: number; taskCount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [clientsRes, hoursRes] = await Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase.from("client_monthly_hours").select("*"),
    ]);
    setClients((clientsRes.data || []) as Client[]);
    setHours((hoursRes.data || []) as ClientMonthlyHours[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Compute usage for the selected month
  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      if (!month || month === "static") {
        setUsage([]);
        setUnmappedClients([]);
        return;
      }
      // Determine month range (UTC to match ISO timestamps from DB)
      const [yyyy, mm] = month.split("-").map(Number);
      const monthStartISO = new Date(Date.UTC(yyyy, mm - 1, 1)).toISOString();
      const monthEndISO = new Date(Date.UTC(yyyy, mm, 1)).toISOString();

      // Fetch tasks attributed to this month (resolved_at within month, OR created_at_yt within month when not resolved)
      // Server-side filter + pagination to bypass the default 1000-row cap.
      const fetchPage = async (from: number, to: number) =>
        supabase
          .from("report_tasks")
          .select("client, spent_minutes, status, resolved_at, created_at_yt")
          .not("client", "is", null)
          .or(
            `and(resolved_at.gte.${monthStartISO},resolved_at.lt.${monthEndISO}),` +
            `and(resolved_at.is.null,created_at_yt.gte.${monthStartISO},created_at_yt.lt.${monthEndISO})`
          )
          .range(from, to);

      const PAGE = 1000;
      const allTasks: any[] = [];
      for (let page = 0; page < 50; page++) {
        const { data, error } = await fetchPage(page * PAGE, page * PAGE + PAGE - 1);
        if (error || !data) break;
        allTasks.push(...data);
        if (data.length < PAGE) break;
      }

      const monthTasks = allTasks.filter((t: any) => (t.status || "").toLowerCase() !== STATUS_ARQUIVADO);

      // Build alias -> client_id map (active clients only for usage, but track all aliases for matching)
      const activeClients = clients.filter(c => c.active);
      const aliasMap = new Map<string, Client>();
      for (const c of activeClients) {
        for (const a of c.aliases || []) {
          aliasMap.set(a.trim().toUpperCase(), c);
        }
        aliasMap.set(c.name.trim().toUpperCase(), c);
      }

      // Aggregate spent per active client + collect unmapped
      const perClient = new Map<string, { spent: number; tasks: number }>();
      const unmapped = new Map<string, { spent: number; tasks: number }>();
      for (const t of monthTasks) {
        const key = String(t.client || "").trim().toUpperCase();
        if (!key) continue;
        const c = aliasMap.get(key);
        const spentH = (t.spent_minutes || 0) / 60;
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
      const usageList: ClientUsage[] = activeClients.map(c => {
        const h = hoursForMonth.find(x => x.client_id === c.id);
        const contracted = h?.contracted_hours || 0;
        const u = perClient.get(c.id) || { spent: 0, tasks: 0 };
        return {
          client: c,
          contractedHours: contracted,
          spentHours: Math.round(u.spent * 10) / 10,
          taskCount: u.tasks,
          utilizationPct: contracted > 0 ? Math.round((u.spent / contracted) * 1000) / 10 : 0,
        };
      });

      if (cancelled) return;
      setUsage(usageList);
      setUnmappedClients(
        Array.from(unmapped.entries())
          .map(([alias, v]) => ({ alias, spentHours: Math.round(v.spent * 10) / 10, taskCount: v.tasks }))
          .sort((a, b) => b.spentHours - a.spentHours)
      );
    };
    compute();
    return () => { cancelled = true; };
  }, [month, clients, hours]);

  return { clients, hours, usage, unmappedClients, loading, refetch };
}
