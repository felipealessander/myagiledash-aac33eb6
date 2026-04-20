import { cn } from "@/lib/utils";
import { TeamData, getTeamTotalHours, getTeamTotalTasks, getTeamVelocity, getTeamColor } from "@/data/dashboardData";
import { Users, Clock, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AIInsightsWidget } from "@/components/dashboard/AIInsightsWidget";

interface TeamCardProps {
  team: TeamData;
  teamIndex?: number;
  delay?: number;
  monthLabel?: string;
  agileMetrics?: { leadTimeAvg: number; cycleTimeAvg: number; throughput: number; wip: number };
  reworkMetrics?: { reworkCount: number; reworkRate: number; corrections: number };
  previousMetrics?: Record<string, unknown> | null;
}

// Known teams keep their CSS classes; dynamic teams use inline styles
const KNOWN_TEAMS: Record<string, { border: string; badge: string; dot: string }> = {
  NaN: {
    border: "border-team-nan/40 hover:border-team-nan/70",
    badge: "bg-team-nan/15 text-team-nan",
    dot: "bg-team-nan",
  },
  "Golden Gate": {
    border: "border-team-golden-gate/40 hover:border-team-golden-gate/70",
    badge: "bg-team-golden-gate/15 text-team-golden-gate",
    dot: "bg-team-golden-gate",
  },
  Code418: {
    border: "border-team-code418/40 hover:border-team-code418/70",
    badge: "bg-team-code418/15 text-team-code418",
    dot: "bg-team-code418",
  },
  Tesseract: {
    border: "border-team-tesseract/40 hover:border-team-tesseract/70",
    badge: "bg-team-tesseract/15 text-team-tesseract",
    dot: "bg-team-tesseract",
  },
};

export function TeamCard({ team, teamIndex = 0, delay = 0, monthLabel, agileMetrics, reworkMetrics, previousMetrics }: TeamCardProps) {
  const totalHours = getTeamTotalHours(team);
  const totalTasks = getTeamTotalTasks(team);
  const velocity = getTeamVelocity(team);

  const known = KNOWN_TEAMS[team.name];
  const dynamicColor = !known ? getTeamColor(teamIndex) : undefined;

  return (
    <div
      className={cn(
        "gradient-card rounded-lg border p-5 transition-all duration-300 opacity-0 animate-fade-in cursor-default",
        known?.border
      )}
      style={{
        animationDelay: `${delay}ms`,
        ...(dynamicColor ? { borderColor: `${dynamicColor}40` } : {}),
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn("h-2.5 w-2.5 rounded-full", known?.dot)}
          style={dynamicColor ? { backgroundColor: dynamicColor } : undefined}
        />
        <h3 className="text-sm font-semibold">{team.name}</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider cursor-help",
                known?.badge
              )}
              style={dynamicColor ? { backgroundColor: `${dynamicColor}22`, color: dynamicColor } : undefined}
            >
              {team.members} devs
            </span>
          </TooltipTrigger>
          {team.memberNames.length > 0 && (
            <TooltipContent side="bottom" className="max-w-[200px]">
              <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Membros do time</p>
              <ul className="space-y-0.5">
                {team.memberNames.map(name => (
                  <li key={name} className="text-xs">{name}</li>
                ))}
              </ul>
            </TooltipContent>
          )}
        </Tooltip>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-wider">Horas</span>
          </div>
          <p className="text-lg font-bold font-mono">{totalHours.toFixed(0)}h</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-wider">Tarefas</span>
          </div>
          <p className="text-lg font-bold font-mono">{totalTasks}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-wider">Precisão</span>
          </div>
          <p className="text-lg font-bold font-mono">{velocity}%</p>
        </div>
      </div>

      {/* Mini bar chart for categories */}
      <div className="mt-4 space-y-1.5">
        {team.categories
          .filter(c => c.spentHours > 0)
          .sort((a, b) => b.spentHours - a.spentHours)
          .slice(0, 4)
          .map(cat => (
            <div key={cat.name} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-20 truncate">{cat.name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full", known?.dot)}
                  style={{
                    width: `${(cat.spentHours / totalHours) * 100}%`,
                    opacity: 0.7,
                    ...(dynamicColor ? { backgroundColor: dynamicColor } : {}),
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{cat.spentHours.toFixed(0)}h</span>
            </div>
          ))}
      </div>

      {monthLabel && (
        <AIInsightsWidget
          scope="team"
          teamName={team.name}
          monthLabel={monthLabel}
          metrics={{
            squad: team.name,
            totalHours: Number(totalHours.toFixed(1)),
            totalTasks,
            estimationAccuracy: `${velocity}%`,
            members: team.members,
            categories: team.categories
              .filter(c => c.spentHours > 0)
              .map(c => ({ name: c.name, spentHours: Number(c.spentHours.toFixed(1)), estimatedHours: Number(c.estimatedHours.toFixed(1)), tasks: c.taskCount })),
            ...(agileMetrics ?? {}),
            ...(reworkMetrics ?? {}),
          }}
          previousMetrics={previousMetrics ?? null}
          compact
        />
      )}
    </div>
  );
}
