import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { withTrend } from "@/lib/chartHelpers";

interface ThroughputData {
  week: string;
  count: number;
}

export interface ThroughputMonthly {
  month: string;
  label: string;
  count: number;
}

interface ThroughputChartProps {
  data: ThroughputData[];
  /** Série mensal (o componente usa os últimos 6 meses). */
  monthlyData?: ThroughputMonthly[];
}

export function ThroughputChart({ data, monthlyData = [] }: ThroughputChartProps) {
  const [view, setView] = useState<"week" | "month">("month");

  const formatted = data.map(d => ({
    ...d,
    label: new Date(d.week).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
  }));

  const monthly = useMemo(
    () => withTrend(monthlyData.slice(-6).map(m => ({ ...m, shortLabel: m.label.slice(0, 3) })), "count"),
    [monthlyData],
  );

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "11px",
    color: "hsl(var(--foreground))",
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Throughput {view === "week" ? "Semanal" : "Mensal"} (tarefas resolvidas)
        </CardTitle>
        <div className="flex rounded-md border border-border overflow-hidden">
          {(["week", "month"] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-[11px] transition-colors ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v === "week" ? "Semanal" : "Mensal"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {view === "week" ? (
          formatted.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Dados insuficientes — nenhuma tarefa resolvida no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={formatted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number) => [`${value} tarefas`, "Resolvidas"]}
                />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )
        ) : monthly.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Dados insuficientes — sem histórico mensal para o filtro aplicado.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={monthly} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="shortLabel" interval={0} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number, name: string) => [name === "trend" ? value.toFixed(1) : `${value} tarefas`, name === "trend" ? "Tendência" : "Resolvidas"]}
                  labelFormatter={(label: string) => {
                    const row = monthly.find(m => m.shortLabel === label);
                    if (!row) return label;
                    const pct = row.deltaPct === null ? "—" : `${row.deltaPct > 0 ? "+" : ""}${row.deltaPct}%`;
                    return `${row.label} · Δ ${row.deltaAbs > 0 ? "+" : ""}${row.deltaAbs} (${pct})`;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "10px" }} formatter={(v) => (v === "trend" ? "Tendência" : "Resolvidas")} />
                <Bar dataKey="count" name="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="trend" name="trend" stroke="hsl(var(--warning))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted-foreground mt-2">
              Últimos {monthly.length} meses, pela data de fechamento da tarefa, respeitando os filtros aplicados.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
