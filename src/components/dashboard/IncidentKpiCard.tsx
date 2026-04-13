import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface IncidentItem {
  task_code: string;
  title: string | null;
  squad: string | null;
}

interface IncidentKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "warning" | "info" | "destructive";
  className?: string;
  delay?: number;
  incidents?: IncidentItem[];
}

const variantStyles = {
  default: "border-border",
  primary: "border-primary/30 glow-primary",
  warning: "border-warning/30",
  info: "border-info/30",
  destructive: "border-destructive/30",
};

const iconVariantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  destructive: "bg-destructive/10 text-destructive",
};

export function IncidentKpiCard({
  title, value, subtitle, icon: Icon, variant = "default", className, delay = 0, incidents,
}: IncidentKpiCardProps) {
  const hasIncidents = incidents && incidents.length > 0;

  const cardContent = (
    <div
      className={cn(
        "gradient-card rounded-lg border p-5 opacity-0 animate-fade-in",
        variantStyles[variant],
        hasIncidents && "cursor-pointer hover:border-primary/50 transition-colors",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight font-mono">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn("rounded-lg p-2.5", iconVariantStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  if (!hasIncidents) return cardContent;

  return (
    <Popover>
      <PopoverTrigger asChild>{cardContent}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="px-3 py-2 border-b border-border">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="text-[10px] text-muted-foreground">{incidents.length} incidente(s)</p>
        </div>
        <ScrollArea className="max-h-64">
          <div className="divide-y divide-border">
            {incidents.map((inc) => (
              <a
                key={inc.task_code}
                href={`https://youtrack.attus.ai/issue/${inc.task_code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs font-mono font-semibold text-primary whitespace-nowrap">
                  {inc.task_code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground truncate">{inc.title || "—"}</p>
                  {inc.squad && (
                    <p className="text-[10px] text-muted-foreground">{inc.squad}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
