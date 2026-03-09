import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { TeamData } from "@/data/dashboardData";
import { getTeamTotalHours, getTeamColor } from "@/data/dashboardData";

const DEFAULT_COLORS = [
  "hsl(280, 67%, 56%)",
  "hsl(38, 92%, 50%)",
  "hsl(160, 84%, 39%)",
  "hsl(210, 100%, 56%)",
  "hsl(0, 84%, 60%)",
  "hsl(190, 90%, 50%)",
  "hsl(330, 80%, 55%)",
  "hsl(60, 70%, 45%)",
];

interface TeamDistributionChartProps {
  teams: TeamData[];
}

export function TeamDistributionChart({ teams }: TeamDistributionChartProps) {
  const data = teams.map(t => ({
    name: t.name,
    value: Math.round(getTeamTotalHours(t)),
  })).sort((a, b) => b.value - a.value);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="gradient-card rounded-lg border border-border p-5 opacity-0 animate-fade-in" style={{ animationDelay: "350ms" }}>
      <h3 className="text-sm font-semibold mb-1">Distribuição por Time</h3>
      <p className="text-xs text-muted-foreground mb-4">Proporção de horas gastas entre os times</p>
      <div className="flex items-center gap-4">
        <div className="h-48 w-48 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {data.map((_, index) => (
                  <Cell key={index} fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]} fillOpacity={0.85} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(225, 22%, 11%)", border: "1px solid hsl(225, 15%, 18%)", borderRadius: "8px", fontSize: "12px", color: "hsl(210, 20%, 92%)" }}
                formatter={(value: number) => [`${value}h`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3 flex-1">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: DEFAULT_COLORS[i % DEFAULT_COLORS.length] }} />
              <span className="text-xs flex-1">{d.name}</span>
              <span className="text-xs font-mono text-muted-foreground">{d.value}h</span>
              <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">
                {total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
