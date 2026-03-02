import { cn } from "@/lib/utils";
import { TeamData, getTeamTotalHours, getTeamTotalTasks, getTeamVelocity } from "@/data/dashboardData";
import { Users, Clock, Zap } from "lucide-react";

interface TeamCardProps {
  team: TeamData;
  delay?: number;
}

const teamColorMap: Record<string, string> = {
  NaN: "border-team-nan/40 hover:border-team-nan/70",
  "Golden Gate": "border-team-golden-gate/40 hover:border-team-golden-gate/70",
  Code418: "border-team-code418/40 hover:border-team-code418/70",
  Tesseract: "border-team-tesseract/40 hover:border-team-tesseract/70",
};

const teamBadgeMap: Record<string, string> = {
  NaN: "bg-team-nan/15 text-team-nan",
  "Golden Gate": "bg-team-golden-gate/15 text-team-golden-gate",
  Code418: "bg-team-code418/15 text-team-code418",
  Tesseract: "bg-team-tesseract/15 text-team-tesseract",
};

const teamDotMap: Record<string, string> = {
  NaN: "bg-team-nan",
  "Golden Gate": "bg-team-golden-gate",
  Code418: "bg-team-code418",
  Tesseract: "bg-team-tesseract",
};

export function TeamCard({ team, delay = 0 }: TeamCardProps) {
  const totalHours = getTeamTotalHours(team);
  const totalTasks = getTeamTotalTasks(team);
  const velocity = getTeamVelocity(team);

  return (
    <div
      className={cn(
        "gradient-card rounded-lg border p-5 transition-all duration-300 opacity-0 animate-fade-in cursor-default",
        teamColorMap[team.name]
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("h-2.5 w-2.5 rounded-full", teamDotMap[team.name])} />
        <h3 className="text-sm font-semibold">{team.name}</h3>
        <span className={cn("ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", teamBadgeMap[team.name])}>
          {team.members} devs
        </span>
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
                  className={cn("h-full rounded-full", teamDotMap[team.name])}
                  style={{ width: `${(cat.spentHours / totalHours) * 100}%`, opacity: 0.7 }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{cat.spentHours.toFixed(0)}h</span>
            </div>
          ))}
      </div>
    </div>
  );
}
