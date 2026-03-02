import { cn } from "@/lib/utils";
import { DollarSign, Ban, HelpCircle } from "lucide-react";
import type { BillingData } from "@/data/dashboardData";

interface BillingKpiCardsProps {
  billingData: BillingData[];
  billingTotalSpent: number;
}

const iconMap = [DollarSign, Ban, HelpCircle];
const styleMap = [
  { iconClass: "bg-primary/10 text-primary", borderClass: "border-primary/30" },
  { iconClass: "bg-warning/10 text-warning", borderClass: "border-warning/30" },
  { iconClass: "bg-muted text-muted-foreground", borderClass: "border-border" },
];

export function BillingKpiCards({ billingData, billingTotalSpent }: BillingKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {billingData.map((data, i) => {
        const Icon = iconMap[i] || HelpCircle;
        const style = styleMap[i] || styleMap[2];
        const pct = billingTotalSpent > 0 ? ((data.spentHours / billingTotalSpent) * 100).toFixed(1) : "0";
        const overrun = data.estimatedHours > 0
          ? (((data.spentHours - data.estimatedHours) / data.estimatedHours) * 100).toFixed(0)
          : null;

        return (
          <div
            key={data.status}
            className={cn("gradient-card rounded-lg border p-5 opacity-0 animate-fade-in", style.borderClass)}
            style={{ animationDelay: `${650 + i * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{data.label}</p>
                <p className="text-xl font-bold font-mono mt-1">{Math.round(data.spentHours)}h</p>
              </div>
              <div className={cn("rounded-lg p-2.5", style.iconClass)}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3">{data.description}</p>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">{data.taskCount} tarefas</span>
              <span className="font-mono font-semibold">{pct}% do total</span>
            </div>
            {overrun !== null && (
              <div className="mt-2 text-[10px]">
                <span className="text-muted-foreground">Desvio: </span>
                <span className={cn("font-mono font-semibold", Number(overrun) > 0 ? "text-destructive" : "text-primary")}>
                  {Number(overrun) > 0 ? "+" : ""}{overrun}%
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
