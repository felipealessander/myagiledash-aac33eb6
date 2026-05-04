import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { GitCompare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { computeClientUsage, type TaskLite, type MonthlyHoursLite } from "@/lib/clientUsage";
import type { Client, ClientMonthlyHours } from "@/hooks/useClientsData";
import type { MonthOption } from "@/hooks/useDashboardData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  months: MonthOption[];
}

// Per-month color pairs: [planned (lighter), realized (saturated)]
const SERIES_COLORS: Array<[string, string]> = [
  ["hsl(217 70% 78%)", "hsl(217 91% 55%)"],
  ["hsl(160 60% 70%)", "hsl(160 84% 40%)"],
  ["hsl(38 80% 75%)", "hsl(38 92% 50%)"],
];
const MAX_MONTHS = 3;

async function fetchTasksForMonth(month: string): Promise<TaskLite[]> {
  const [yyyy, mm] = month.split("-").map(Number);
  const start = new Date(Date.UTC(yyyy, mm - 1, 1)).toISOString();
  const end = new Date(Date.UTC(yyyy, mm, 1)).toISOString();
  const PAGE = 1000;
  const all: TaskLite[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("report_tasks")
      .select("client, spent_minutes, status, resolved_at, created_at_yt")
      .not("client", "is", null)
      .or(
        `and(resolved_at.gte.${start},resolved_at.lt.${end}),` +
        `and(resolved_at.is.null,created_at_yt.gte.${start},created_at_yt.lt.${end})`
      )
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error || !data) break;
    all.push(...(data as TaskLite[]));
    if (data.length < PAGE) break;
  }
  return all;
}

export function ClientHoursComparison({ months }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [hours, setHours] = useState<ClientMonthlyHours[]>([]);
  const [tasksByMonth, setTasksByMonth] = useState<Record<string, TaskLite[]>>({});
  const [loading, setLoading] = useState(false);

  // Load clients & contracted hours once
  useEffect(() => {
    (async () => {
      const [c, h] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("client_monthly_hours").select("*"),
      ]);
      setClients((c.data || []) as Client[]);
      setHours((h.data || []) as ClientMonthlyHours[]);
    })();
  }, []);

  // Load tasks for newly selected months
  useEffect(() => {
    const missing = selected.filter(m => !tasksByMonth[m]);
    if (missing.length === 0) return;
    setLoading(true);
    Promise.all(missing.map(async m => [m, await fetchTasksForMonth(m)] as const))
      .then(results => {
        setTasksByMonth(prev => {
          const next = { ...prev };
          for (const [m, t] of results) next[m] = t;
          return next;
        });
      })
      .finally(() => setLoading(false));
  }, [selected, tasksByMonth]);

  const monthLabel = (v: string) => months.find(m => m.value === v)?.label || v;

  const toggleMonth = (value: string) => {
    setSelected(prev => {
      if (prev.includes(value)) return prev.filter(v => v !== value);
      if (prev.length >= MAX_MONTHS) return prev;
      return [...prev, value];
    });
  };

  const chartData = useMemo(() => {
    if (selected.length === 0) return [];
    // Compute usage per month
    const perMonth: Record<string, Map<string, { spent: number; contracted: number }>> = {};
    for (const m of selected) {
      const tasks = tasksByMonth[m] || [];
      const { usage } = computeClientUsage(m, clients, tasks, hours as MonthlyHoursLite[]);
      const map = new Map<string, { spent: number; contracted: number }>();
      for (const u of usage) map.set(u.clientName, { spent: u.spentHours, contracted: u.contractedHours });
      perMonth[m] = map;
    }
    // Union of clients with any data
    const names = new Set<string>();
    for (const m of selected) {
      for (const [name, v] of perMonth[m]) {
        if (v.spent > 0 || v.contracted > 0) names.add(name);
      }
    }
    return Array.from(names).map(name => {
      const row: any = { name };
      let total = 0;
      for (const m of selected) {
        const v = perMonth[m].get(name);
        const spent = Math.round(v?.spent || 0);
        const planned = Math.round(v?.contracted || 0);
        row[`spent_${m}`] = spent;
        row[`planned_${m}`] = planned;
        total += spent + planned;
      }
      row.__total = total;
      return row;
    }).sort((a, b) => b.__total - a.__total);
  }, [selected, tasksByMonth, clients, hours]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          Comparativo de Períodos — Realizado por Cliente
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.map((m, i) => (
            <span
              key={m}
              className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 border"
              style={{ borderColor: SERIES_COLORS[i][1], color: SERIES_COLORS[i][1] }}
            >
              {monthLabel(m)}
              <button onClick={() => toggleMonth(m)} className="hover:opacity-70">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                {selected.length === 0 ? "Selecionar meses" : `${selected.length}/${MAX_MONTHS} selecionados`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 max-h-80 overflow-y-auto" align="end">
              <p className="text-xs text-muted-foreground px-2 py-1">Escolha até {MAX_MONTHS} meses</p>
              {months.map(m => {
                const checked = selected.includes(m.value);
                const disabled = !checked && selected.length >= MAX_MONTHS;
                return (
                  <label
                    key={m.value}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() => toggleMonth(m.value)}
                    />
                    {m.label}
                  </label>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        {selected.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            Selecione 2 ou 3 meses para comparar.
          </div>
        ) : loading && chartData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
        ) : chartData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sem dados nos meses selecionados.</div>
        ) : (
          <div style={{ height: Math.max(320, chartData.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="h" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }} width={180} />
                <RechartsTooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                  contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--popover-foreground))" }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  formatter={(v: number, name: string) => {
                    const isPlanned = name.startsWith("planned_");
                    const m = name.replace(/^(planned_|spent_)/, "");
                    return [`${v.toLocaleString()}h`, `${monthLabel(m)} — ${isPlanned ? "Previsão" : "Realizado"}`];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  formatter={(v: string) => {
                    const isPlanned = v.startsWith("planned_");
                    const m = v.replace(/^(planned_|spent_)/, "");
                    return <span style={{ color: "hsl(var(--foreground))" }}>{monthLabel(m)} — {isPlanned ? "Previsão" : "Realizado"}</span>;
                  }}
                />
                {selected.map((m, i) => (
                  <>
                    <Bar key={`p-${m}`} dataKey={`planned_${m}`} fill={SERIES_COLORS[i][0]} opacity={0.85} />
                    <Bar key={`s-${m}`} dataKey={`spent_${m}`} fill={SERIES_COLORS[i][1]} />
                  </>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
