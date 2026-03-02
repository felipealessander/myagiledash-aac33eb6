import { billingData, billingTotalSpent } from "@/data/dashboardData";
import { cn } from "@/lib/utils";
import { DollarSign, Ban, HelpCircle } from "lucide-react";

const cards = [
  {
    data: billingData[0], // Faturável
    icon: DollarSign,
    iconClass: "bg-primary/10 text-primary",
    borderClass: "border-primary/30",
  },
  {
    data: billingData[1], // Não Faturável
    icon: Ban,
    iconClass: "bg-warning/10 text-warning",
    borderClass: "border-warning/30",
  },
  {
    data: billingData[2], // Sem Marcação
    icon: HelpCircle,
    iconClass: "bg-muted text-muted-foreground",
    borderClass: "border-border",
  },
];

export function BillingKpiCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card, i) => {
        const pct = ((card.data.spentHours / billingTotalSpent) * 100).toFixed(1);
        const overrun = card.data.estimatedHours > 0
          ? (((card.data.spentHours - card.data.estimatedHours) / card.data.estimatedHours) * 100).toFixed(0)
          : null;

        return (
          <div
            key={card.data.status}
            className={cn(
              "gradient-card rounded-lg border p-5 opacity-0 animate-fade-in",
              card.borderClass
            )}
            style={{ animationDelay: `${650 + i * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{card.data.label}</p>
                <p className="text-xl font-bold font-mono mt-1">{Math.round(card.data.spentHours)}h</p>
              </div>
              <div className={cn("rounded-lg p-2.5", card.iconClass)}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3">{card.data.description}</p>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">{card.data.taskCount} tarefas</span>
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
