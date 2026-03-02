import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { BillingData } from "@/data/dashboardData";

interface BillingComparisonChartProps {
  billingData: BillingData[];
}

export function BillingComparisonChart({ billingData }: BillingComparisonChartProps) {
  const data = billingData.map(b => ({
    name: b.label,
    estimado: Math.round(b.estimatedHours),
    realizado: Math.round(b.spentHours),
  }));

  return (
    <div className="gradient-card rounded-lg border border-border p-5 opacity-0 animate-fade-in" style={{ animationDelay: "600ms" }}>
      <h3 className="text-sm font-semibold mb-1">Estimado vs Realizado por Faturamento</h3>
      <p className="text-xs text-muted-foreground mb-4">Comparação entre horas previstas e efetivas por classificação</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 18%)" />
            <XAxis dataKey="name" tick={{ fill: "hsl(215, 15%, 52%)", fontSize: 11 }} axisLine={{ stroke: "hsl(225, 15%, 18%)" }} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215, 15%, 52%)", fontSize: 10 }} axisLine={false} tickLine={false} unit="h" />
            <Tooltip
              contentStyle={{ background: "hsl(225, 22%, 11%)", border: "1px solid hsl(225, 15%, 18%)", borderRadius: "8px", fontSize: "12px", color: "hsl(210, 20%, 92%)" }}
              formatter={(value: number, name: string) => [`${value}h`, name === "estimado" ? "Estimado" : "Realizado"]}
            />
            <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(215, 15%, 52%)" }} />
            <Bar dataKey="estimado" fill="hsl(210, 100%, 56%)" radius={[4, 4, 0, 0]} fillOpacity={0.6} />
            <Bar dataKey="realizado" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
