import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Timer } from "lucide-react";
import { splitBySufficiency } from "@/lib/chartHelpers";

interface LeadTimeData {
  squad: string;
  avg: number;
  median: number;
  p85: number;
  count: number;
}

interface LeadTimeChartProps {
  data: LeadTimeData[];
}

export function LeadTimeChart({ data }: LeadTimeChartProps) {
  const { withData, insufficient } = splitBySufficiency(data || []);
  const chartData = [...withData].sort((a, b) => b.median - a.median);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          Lead Time por Squad (dias úteis, sem incidentes)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Dados insuficientes — nenhuma tarefa resolvida no período.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 55 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="squad"
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: "hsl(var(--foreground))",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}d`, name]}
                  labelFormatter={(label: string) => {
                    const row = chartData.find(d => d.squad === label);
                    return row ? `${label} · ${row.count} card(s)` : label;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Bar dataKey="median" name="Mediana" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avg" name="Média" fill="hsl(var(--primary) / 0.5)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="p85" name="P85" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {insufficient.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Dados insuficientes: {insufficient.map(d => d.squad).join(", ")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
