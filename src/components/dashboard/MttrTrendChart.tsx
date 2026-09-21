import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Timer } from "lucide-react";
import type { MttrTrendPoint } from "@/lib/mttr";

interface Props {
  data: MttrTrendPoint[];
}

export function MttrTrendChart({ data }: Props) {
  return (
    <Card className="gradient-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Timer className="h-4 w-4 text-warning" />
          MTTR mensal (dias corridos até a resolução)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sem incidentes resolvidos no período.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number, name: string) =>
                    name === "Incidentes" ? [value, name] : [`${Number(value).toFixed(1)}d`, name]
                  }
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="count" name="Incidentes" fill="hsl(var(--muted-foreground))" opacity={0.35} radius={[4, 4, 0, 0]} />
                <Line dataKey="avg" name="MTTR médio" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="median" name="Mediana" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="p85" name="P85" stroke="hsl(0, 84%, 65%)" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
