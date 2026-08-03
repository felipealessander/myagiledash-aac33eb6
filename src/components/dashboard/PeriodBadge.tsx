import { CalendarRange, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PeriodSummary } from "@/lib/monthComparison";

interface Props {
  period: PeriodSummary;
  squads?: string[];
  className?: string;
}

/** Chip que deixa explícito o período (e squads) considerados no bloco. */
export function PeriodBadge({ period, squads = [], className }: Props) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <CalendarRange className="h-3 w-3" />
        {period.label}
      </span>
      {squads.length > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
          <Users className="h-3 w-3" />
          {squads.length === 1 ? squads[0] : `${squads.length} squads`}
        </span>
      )}
    </div>
  );
}
