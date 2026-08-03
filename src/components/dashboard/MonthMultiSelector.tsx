import { Check, CalendarRange, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { MonthOption } from "@/hooks/useDashboardData";
import { monthShortLabel } from "@/lib/monthComparison";

interface Props {
  months: MonthOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

/**
 * Filtro global de meses (multi-seleção).
 * Seleção vazia = consolidado do ano.
 */
export function MonthMultiSelector({ months, selected, onChange }: Props) {
  const ordered = [...months].sort((a, b) => a.value.localeCompare(b.value));

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };

  const summary =
    selected.length === 0
      ? "Ano consolidado"
      : selected.length === 1
        ? monthShortLabel(selected[0])
        : `${selected.length} meses`;

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-2">
            <CalendarRange className="h-3.5 w-3.5" />
            {summary}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Meses</span>
            <div className="flex gap-1">
              <button
                type="button"
                className="text-[10px] text-primary hover:underline"
                onClick={() => onChange(ordered.map(m => m.value))}
              >
                Todos
              </button>
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:underline"
                onClick={() => onChange([])}
              >
                Limpar
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {ordered.map(m => {
              const active = selected.includes(m.value);
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => toggle(m.value)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                    active ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-foreground",
                  )}
                >
                  <span className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center", active ? "border-primary" : "border-border")}>
                    {active && <Check className="h-2.5 w-2.5" />}
                  </span>
                  {m.label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onChange([])}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
