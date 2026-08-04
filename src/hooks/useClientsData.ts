import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeClientUsage, buildAliasMap, type TaskLite } from "@/lib/clientUsage";
import { isArchivedStatus } from "@/lib/taskRules";

export interface ClientTaskRow {
  taskCode: string;
  title: string;
  squad: string;
  status: string;
  clientName: string;
  clientTag: string;
  mapped: boolean;
  hours: number;
  resolvedAt: string | null;
  createdAt: string | null;
}


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
      // Determine range (UTC to match ISO timestamps from DB). Supports "YYYY-MM" and "year-YYYY".
      let monthStartISO: string;
      let monthEndISO: string;
      if (month.startsWith("year-")) {
        const yyyy = Number(month.slice(5));
        if (!Number.isFinite(yyyy)) { setUsage([]); setUnmappedClients([]); return; }
        monthStartISO = new Date(Date.UTC(yyyy, 0, 1)).toISOString();
        monthEndISO = new Date(Date.UTC(yyyy + 1, 0, 1)).toISOString();
      } else {
        const [yyyy, mm] = month.split("-").map(Number);
        if (!Number.isFinite(yyyy) || !Number.isFinite(mm)) { setUsage([]); setUnmappedClients([]); return; }
        monthStartISO = new Date(Date.UTC(yyyy, mm - 1, 1)).toISOString();
        monthEndISO = new Date(Date.UTC(yyyy, mm, 1)).toISOString();
      }

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

      const { usage: usageRows, unmapped } = computeClientUsage(
        month,
        clients,
        allTasks as TaskLite[],
        hours
      );

      const usageList: ClientUsage[] = usageRows.map(r => {
        const client = clients.find(c => c.id === r.clientId)!;
        return {
          client,
          contractedHours: r.contractedHours,
          spentHours: r.spentHours,
          taskCount: r.taskCount,
          utilizationPct: r.utilizationPct,
        };
      });

      if (cancelled) return;
      setUsage(usageList);
      setUnmappedClients(unmapped);
    };
    compute();
    return () => { cancelled = true; };
  }, [month, clients, hours]);

  return { clients, hours, usage, unmappedClients, loading, refetch };
}
