import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildComparison, summarizeSeries } from "@/lib/monthComparison";
import { buildTrendMask, linearTrend } from "@/lib/chartHelpers";

export interface ComparisonMetric {
  key: string;
  label: string;
  unit?: string;
  /** true quando aumentar é ruim (ex.: lead time, retrabalho). */
  lowerIsBetter?: boolean;
  values: { month: string; value: number }[];
}

interface Props {
  title?: string;
  months: string[];
  metrics: ComparisonMetric[];
  /** Clique numa barra abre o detalhamento dos cards daquele mês. */
  onDrill?: (month: string, metricKey: string) => void;
}

function DeltaTag({ delta, pct, lowerIsBetter }: { delta: number | null; pct: number | null; lowerIsBetter?: boolean }) {
  if (delta === null) return <span className="text-muted-foreground">—</span>;
  const neutral = delta === 0;
  const good = lowerIsBetter ? delta < 0 : delta > 0;
  const Icon = neutral ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono", neutral ? "text-muted-foreground" : good ? "text-success" : "text-destructive")}>
      <Icon className="h-3 w-3" />
      {delta > 0 ? "+" : ""}{delta}
      {pct !== null && <span className="opacity-70">({pct > 0 ? "+" : ""}{pct}%)</span>}
    </span>
  );
}

/**
 * Painel de comparação mensal reutilizável: gráfico por mês + linha de
 * tendência + tabela com variação absoluta e percentual.
 * Meses sem registros aparecem com valor 0 e marcação "sem dados".
 */
export function MonthComparisonPanel({ title = "Comparação mensal", months, metrics, onDrill }: Props) {
  const [activeKey, setActiveKey] = useState(metrics[0]?.key);
  const metric = metrics.find(m => m.key === activeKey) ?? metrics[0];

  const rows = useMemo(
    () => (metric ? buildComparison(metric.values, months) : []),
    [metric, months],
  );

  const chartData = useMemo(() => {
    // Meses sem registros e o mês corrente (parcial) não influenciam a inclinação.
    const values = rows.map(r => r.value);
    const trend = linearTrend(
      values,
      buildTrendMask(values, rows.map(r => r.month), { hasData: rows.map(r => r.hasData) }),
    );
    return rows.map((r, i) => ({ ...r, trend: trend[i] }));

  }, [rows]);

  const summary = useMemo(() => summarizeSeries(rows), [rows]);

  if (!metric || months.length < 2) {
    return (
      <div className="gradient-card rounded-lg border border-border p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          Selecione dois ou mais meses no filtro global para comparar períodos.
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-card rounded-lg border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex flex-wrap gap-1">
          {metrics.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => setActiveKey(m.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] transition-colors",
                m.key === metric.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-3 text-xs text-muted-foreground">
        <span>Total: <strong className="font-mono text-foreground">{summary.total}{metric.unit ?? ""}</strong></span>
        <span>Média/mês: <strong className="font-mono text-foreground">{summary.avg}{metric.unit ?? ""}</strong></span>
        <span>Meses com dados: <strong className="font-mono text-foreground">{summary.withData}/{rows.length}</strong></span>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number, name: string) => [`${Math.round(v * 10) / 10}${metric.unit ?? ""}`, name === "trend" ? "Tendência" : metric.label]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            dataKey="value"
            name={metric.label}
            radius={[4, 4, 0, 0]}
            cursor={onDrill ? "pointer" : undefined}
            onClick={(d: any) => onDrill?.(d?.month, metric.key)}
          >
            {chartData.map(d => (
              <Cell key={d.month} fill={d.hasData ? "hsl(var(--primary))" : "hsl(var(--muted))"} />
            ))}
          </Bar>
          <Line type="monotone" dataKey="trend" name="Tendência" stroke="hsl(var(--warning))" strokeDasharray="5 5" dot={false} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-3 text-left">Mês</th>
              <th className="py-2 pr-3 text-right">{metric.label}</th>
              <th className="py-2 pr-3 text-right">Δ abs.</th>
              <th className="py-2 text-right">Δ %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.month}
                className={cn("border-b border-border/50", onDrill && "cursor-pointer hover:bg-muted/40")}
                onClick={() => onDrill?.(r.month, metric.key)}
              >
                <td className="py-2 pr-3">
                  {r.label}
                  {!r.hasData && <span className="ml-2 text-[10px] text-muted-foreground">sem dados</span>}
                </td>
                <td className="py-2 pr-3 text-right font-mono">{r.value}{metric.unit ?? ""}</td>
                <td className="py-2 pr-3 text-right"><DeltaTag delta={r.delta} pct={null} lowerIsBetter={metric.lowerIsBetter} /></td>
                <td className="py-2 text-right"><DeltaTag delta={r.deltaPct === null ? null : r.deltaPct} pct={null} lowerIsBetter={metric.lowerIsBetter} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
