import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { RotateCcw } from "lucide-react";
import { getTeamColor } from "@/data/dashboardData";

interface ReworkChartProps {
  data: { squad: string; count: number; corrections: number; rate: number }[];
}

export function ReworkChart({ data }: ReworkChartProps) {
  if (!data || data.length === 0) return null;

  const filtered = data.filter(d => d.corrections > 0);
  if (filtered.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            Retrabalho por Squad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma correção registrada no período</p>
        </CardContent>
      </Card>
    );
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              itemStyle={{ color: "hsl(var(--foreground))" }}

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
          Retrabalho por Squad
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={filtered} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="squad" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number, name: string) => {
                if (name === "corrections") return [value, "Total correções"];
                if (name === "count") return [value, "Tarefas com retrabalho"];
                return [value, name];
              }}
            />
            <Bar dataKey="corrections" radius={[4, 4, 0, 0]} name="corrections">
              {filtered.map((_, i) => (
                <Cell key={i} fill={getTeamColor(i)} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {filtered.map((d, i) => (
            <span key={d.squad} className="text-[10px] text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: getTeamColor(i) }} />
              {d.squad}: {d.rate}%
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
