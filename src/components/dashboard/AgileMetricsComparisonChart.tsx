import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { GitCompare } from "lucide-react";

interface SquadAgile {
  squad: string;
  leadAvg: number;
  cycleAvg: number;
  throughput: number;
  wip: number;
}

interface Props {
  data: SquadAgile[];
}

export function AgileMetricsComparisonChart({ data }: Props) {
  const filtered = data.filter(d => d.leadAvg > 0 || d.cycleAvg > 0 || d.throughput > 0 || d.wip > 0);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-muted-foreground" />
          Métricas Ágeis – Comparativo entre Times
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Selecione 2 ou mais times para comparar.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
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
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "Lead Time" || name === "Cycle Time") return [`${value.toFixed(1)}d`, name];
                  return [value, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: "10px" }} />
              <Bar dataKey="leadAvg" name="Lead Time" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cycleAvg" name="Cycle Time" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="throughput" name="Throughput" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="wip" name="WIP" fill="hsl(280, 67%, 56%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
