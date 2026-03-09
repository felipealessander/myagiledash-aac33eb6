import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AlertCircle } from "lucide-react";
import type { BillingData } from "@/data/dashboardData";

const COLORS = [
  "hsl(160, 84%, 39%)",
  "hsl(38, 92%, 50%)",
  "hsl(215, 15%, 42%)",
];

interface BillingOverviewChartProps {
  billingData: BillingData[];
  billingTotalSpent: number;
}

export function BillingOverviewChart({ billingData, billingTotalSpent }: BillingOverviewChartProps) {
  const data = billingData.map(b => ({
    name: b.label,
    fullName: b.status,
    description: b.description,
    value: Math.round(b.spentHours),
    tasks: b.taskCount,
  }));

  return (
    <div className="gradient-card rounded-lg border border-border p-5 opacity-0 animate-fade-in" style={{ animationDelay: "550ms" }}>
      <h3 className="text-sm font-semibold mb-1">Classificação de Faturamento</h3>
      <p className="text-xs text-muted-foreground mb-4">Distribuição de horas por status de faturamento</p>
      <div className="flex items-center gap-6">
        <div className="h-52 w-52 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index]} fillOpacity={0.85} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(225, 22%, 11%)", border: "1px solid hsl(225, 15%, 18%)", borderRadius: "8px", fontSize: "12px", color: "hsl(210, 20%, 92%)" }}
                labelStyle={{ color: "hsl(210, 20%, 92%)" }}
                itemStyle={{ color: "hsl(210, 20%, 92%)" }}
                formatter={(value: number, _: string, entry: { payload: typeof data[0] }) => [`${value}h (${entry.payload.tasks} tarefas)`, entry.payload.fullName]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-4 flex-1">
          {data.map((d, i) => (
            <div key={d.name}>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                <span className="text-xs font-semibold flex-1">{d.name}</span>
                <span className="text-xs font-mono font-semibold">{d.value}h</span>
                <span className="text-[10px] font-mono text-muted-foreground w-12 text-right">
                  {billingTotalSpent > 0 ? ((d.value / billingTotalSpent) * 100).toFixed(1) : "0"}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground ml-[18px]">{d.description}</p>
            </div>
          ))}
          <div className="flex items-start gap-1.5 mt-3 p-2 rounded-md bg-warning/5 border border-warning/20">
            <AlertCircle className="h-3.5 w-3.5 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-warning/80">
              <strong>{billingTotalSpent > 0 ? Math.round((data[2]?.value || 0) / billingTotalSpent * 100) : 0}%</strong> das horas não possuem marcação de faturamento — considere revisar essas tarefas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
