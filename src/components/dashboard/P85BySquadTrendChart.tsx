import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { MonthlyTrendPoint } from "@/hooks/useDashboardData";

interface Props {
  data: MonthlyTrendPoint[];
  metric: "lead" | "cycle";
  selectedSquads?: string[];
  title?: string;
  description?: string;
}

const SQUAD_COLORS = [
  "hsl(210, 100%, 56%)",
  "hsl(160, 84%, 39%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 67%, 56%)",
  "hsl(0, 72%, 51%)",
  "hsl(180, 60%, 45%)",
  "hsl(330, 75%, 55%)",
  "hsl(50, 90%, 50%)",
];

export function P85BySquadTrendChart({ data, metric, selectedSquads = [], title, description }: Props) {
  const key = metric === "lead" ? "leadTimeBySquad" : "cycleTimeBySquad";
  const globalMedianKey = metric === "lead" ? "leadTimeMedianGlobal" : "cycleTimeMedianGlobal";
  const globalP85Key = metric === "lead" ? "leadTimeP85Global" : "cycleTimeP85Global";

  const hasFilter = selectedSquads.length > 0;

  // Pivot
  const chartData = data.map(p => {
    const row: Record<string, any> = {
      shortLabel: p.label.slice(0, 3),
      _medianGlobal: p[globalMedianKey],
      _p85Global: p[globalP85Key],
    };
    if (hasFilter) {
      const bySquad = new Map(p[key].map(s => [s.squad, s]));
      for (const sq of selectedSquads) {
        const entry = bySquad.get(sq);
        row[`${sq}__median`] = entry && entry.count > 0 ? entry.median : null;
        row[`${sq}__p85`] = entry && entry.count > 0 ? entry.p85 : null;
      }
    }
    return row;
  });

  const heading = title || (hasFilter
    ? `Mediana & P85 ${metric === "lead" ? "Lead Time" : "Cycle Time"} por Squad`
    : `P85 ${metric === "lead" ? "Lead Time" : "Cycle Time"} (Geral)`);
  const sub = description || (hasFilter
    ? "Acompanhamento mensal por squad selecionada (mediana sólida, P85 tracejada)"
    : "P85 mensal considerando todas as squads juntas");

  return (
    <div className="gradient-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold mb-1">{heading}</h3>
      <p className="text-xs text-muted-foreground mb-4">{sub}</p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="shortLabel" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="d" />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px", color: "hsl(var(--foreground))" }}
              formatter={(v: number, name: string) => v == null ? ["—", name] : [`${v}d`, name]}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />

            {!hasFilter && (
              <Line
                type="monotone"
                dataKey="_medianGlobal"
                name="Mediana Geral"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 4 }}
              />
            )}

            {hasFilter && selectedSquads.map((sq, i) => (
              <Line
                key={`${sq}-median`}
                type="monotone"
                dataKey={`${sq}__median`}
                name={`${sq} – Mediana`}
                stroke={SQUAD_COLORS[i % SQUAD_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
            {hasFilter && selectedSquads.map((sq, i) => (
              <Line
                key={`${sq}-p85`}
                type="monotone"
                dataKey={`${sq}__p85`}
                name={`${sq} – P85`}
                stroke={SQUAD_COLORS[i % SQUAD_COLORS.length]}
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
