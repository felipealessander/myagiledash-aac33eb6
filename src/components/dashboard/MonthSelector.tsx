import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import type { MonthOption } from "@/hooks/useDashboardData";

interface MonthSelectorProps {
  months: MonthOption[];
  selected: string;
  onSelect: (value: string) => void;
}

export function MonthSelector({ months, selected, onSelect }: MonthSelectorProps) {
  // Extract unique years from available months
  const years = Array.from(new Set(months.map(m => m.value.slice(0, 4)))).sort().reverse();

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select value={selected} onValueChange={onSelect}>
        <SelectTrigger className="w-[200px] h-8 text-xs">
          <SelectValue placeholder="Selecione o período" />
        </SelectTrigger>
        <SelectContent>
          {years.map(year => (
            <SelectItem key={`year-${year}`} value={`year-${year}`}>
              📊 Ano {year} (Consolidado)
            </SelectItem>
          ))}
          {months.map(m => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
