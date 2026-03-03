import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Gauge } from "lucide-react";

interface CycleTimeData {
  squad: string;
  avg: number;
  median: number;
  p85: number;
  count: number;
}

interface CycleTimeChartProps {
  data: CycleTimeData[];
}

export function CycleTimeChart({ data }: CycleTimeChartProps) {
  const filtered = data.filter(d => d.count > 0);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          Cycle Time por Squad (dias)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhuma tarefa com dados de início e conclusão encontrada.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={filtered} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="squad" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}d`, name]}
              />
              <Legend wrapperStyle={{ fontSize: "10px" }} />
              <Bar dataKey="median" name="Mediana" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avg" name="Média" fill="hsl(var(--info) / 0.5)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="p85" name="P85" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}