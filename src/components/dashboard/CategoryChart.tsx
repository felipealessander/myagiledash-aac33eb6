import { categoryTotals } from "@/data/dashboardData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = [
  "hsl(160, 84%, 39%)",
  "hsl(210, 100%, 56%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 67%, 56%)",
  "hsl(0, 72%, 51%)",
  "hsl(180, 60%, 45%)",
  "hsl(320, 70%, 50%)",
];

const data = categoryTotals.map(c => ({
  name: c.name,
  hours: Math.round(c.hours),
  tasks: c.count,
}));

export function CategoryChart() {
  return (
    <div className="gradient-card rounded-lg border border-border p-5 opacity-0 animate-fade-in" style={{ animationDelay: "300ms" }}>
      <h3 className="text-sm font-semibold mb-1">Horas por Categoria</h3>
      <p className="text-xs text-muted-foreground mb-4">Distribuição do tempo gasto por tipo de atividade</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 18%)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(215, 15%, 52%)", fontSize: 10 }}
              axisLine={{ stroke: "hsl(225, 15%, 18%)" }}
              tickLine={false}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fill: "hsl(215, 15%, 52%)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              unit="h"
            />
            <Tooltip
              contentStyle={{
                background: "hsl(225, 22%, 11%)",
                border: "1px solid hsl(225, 15%, 18%)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(210, 20%, 92%)",
              }}
              formatter={(value: number) => [`${value}h`, "Tempo gasto"]}
            />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
