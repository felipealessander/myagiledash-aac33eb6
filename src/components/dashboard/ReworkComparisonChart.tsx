import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { RotateCcw } from "lucide-react";

interface ReworkRow {
  squad: string;
  count: number;
  corrections: number;
  rate: number;
}

interface Props {
  data: ReworkRow[];
}

export function ReworkComparisonChart({ data }: Props) {
  const filtered = data.filter(d => d.count > 0 || d.corrections > 0);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
          Retrabalho – Comparativo entre Times
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
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "11px",
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "Taxa") return [`${value}%`, name];
                  return [value, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: "10px" }} />
              <Bar yAxisId="left" dataKey="count" name="Tarefas com Retrabalho" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="corrections" name="Total de Correções" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="rate" name="Taxa" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
