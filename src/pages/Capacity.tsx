import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCapacityData } from "@/hooks/useCapacityData";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Users, Clock, TrendingUp, Loader2, ShieldAlert, Gauge, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { getTeamColor } from "@/data/dashboardData";

const Capacity = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { approved, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { months, selectedMonth, setSelectedMonth, summaries, totals, loading } = useCapacityData();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  if (!authLoading && !roleLoading && user && !approved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <ShieldAlert className="h-12 w-12 text-warning mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Acesso Pendente</h2>
          <p className="text-muted-foreground text-sm">Sua conta ainda precisa ser aprovada por um administrador.</p>
          <Button variant="outline" onClick={signOut}>Sair</Button>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getUtilizationColor = (pct: number) => {
    if (pct > 100) return "text-destructive";
    if (pct > 85) return "text-warning";
    if (pct > 60) return "text-primary";
    return "text-muted-foreground";
  };

  const getUtilizationBg = (pct: number) => {
    if (pct > 100) return "bg-destructive";
    if (pct > 85) return "bg-warning";
    return "bg-primary";
  };

  const chartData = summaries.map((s, i) => ({
    name: s.name,
    capacidade: s.productiveHours,
    estimado: s.estimatedHours,
    realizado: s.spentHours,
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 pl-10">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Gauge className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Capacidade Produtiva</h1>
              <p className="text-[10px] text-muted-foreground">Visão de capacidade por squad</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {months.length > 0 && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <main className="container mx-auto px-4 py-6 space-y-8">
          {/* KPIs Consolidados */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Visão Consolidada
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="FTE Total" value={totals.fte.toFixed(1)} subtitle={`${totals.members} pessoas na organização`} icon={Users} variant="primary" delay={0} />
              <KpiCard title="Capacidade Produtiva" value={`${totals.productive}h`} subtitle={`${totals.theoretical}h teóricas · 80% eficiência`} icon={Clock} variant="info" delay={50} />
              <KpiCard title="Utilização" value={`${totals.utilizationPct}%`} subtitle={`${totals.spent}h realizadas / ${totals.productive}h capacidade`} icon={TrendingUp} variant={totals.utilizationPct > 100 ? "destructive" : totals.utilizationPct > 85 ? "warning" : "default"} delay={100} />
              <KpiCard title="Planejamento" value={`${totals.estimationPct}%`} subtitle={`${totals.estimated}h estimadas / ${totals.productive}h capacidade`} icon={AlertTriangle} variant={totals.estimationPct > 100 ? "warning" : "default"} delay={150} />
            </div>
          </section>

          {/* Gráfico comparativo */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Capacidade vs Estimado vs Realizado
            </h2>
            <div className="gradient-card rounded-lg border border-border p-5">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="h" />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px", color: "hsl(var(--foreground))" }}
                      formatter={(v: number, name: string) => [`${v}h`, name === "capacidade" ? "Capacidade" : name === "estimado" ? "Estimado" : "Realizado"]}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v) => v === "capacidade" ? "Capacidade Produtiva" : v === "estimado" ? "Estimado" : "Realizado"} />
                    <Bar dataKey="capacidade" fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="estimado" fill="hsl(var(--primary))" opacity={0.6} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Cards por Squad */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <Users className="h-4 w-4" />
              Detalhamento por Squad
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {summaries.map((squad, i) => (
                <div
                  key={squad.name}
                  className="gradient-card rounded-lg border border-border p-5 space-y-4 opacity-0 animate-fade-in"
                  style={{ animationDelay: `${i * 80}ms`, borderColor: `${getTeamColor(i)}40` }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getTeamColor(i) }} />
                      <div>
                        <h3 className="text-sm font-semibold">{squad.name}</h3>
                        <p className="text-[10px] text-muted-foreground">{squad.product}</p>
                      </div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider cursor-help"
                          style={{ backgroundColor: `${getTeamColor(i)}22`, color: getTeamColor(i) }}>
                          {squad.fteEquivalent} FTE · {squad.totalMembers} pessoas
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[250px]">
                        <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Composição</p>
                        <ul className="space-y-0.5">
                          {squad.members.map((m) => (
                            <li key={m.name} className="text-xs flex justify-between gap-4">
                              <span>{m.name}</span>
                              <span className="text-muted-foreground">
                                {m.role}{m.cross ? ` · ${Math.round(m.allocation * 100)}%` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Capacidade</span>
                      <p className="text-lg font-bold font-mono">{squad.productiveHours}h</p>
                      <p className="text-[10px] text-muted-foreground">{squad.theoreticalHours}h teóricas</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Estimado</span>
                      <p className="text-lg font-bold font-mono">{squad.estimatedHours}h</p>
                      <p className="text-[10px] text-muted-foreground">{squad.estimationPct}% da cap.</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Realizado</span>
                      <p className="text-lg font-bold font-mono">{squad.spentHours}h</p>
                      <p className={cn("text-[10px]", getUtilizationColor(squad.utilizationPct))}>{squad.utilizationPct}% utilização</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Gap</span>
                      <p className={cn("text-lg font-bold font-mono", squad.productiveHours - squad.spentHours > 0 ? "text-primary" : "text-destructive")}>
                        {squad.productiveHours - squad.spentHours > 0 ? "+" : ""}{squad.productiveHours - squad.spentHours}h
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {squad.productiveHours - squad.spentHours > 0 ? "disponível" : "sobrecarregado"}
                      </p>
                    </div>
                  </div>

                  {/* Utilization bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Utilização da capacidade</span>
                      <span className={cn("font-semibold", getUtilizationColor(squad.utilizationPct))}>{squad.utilizationPct}%</span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", getUtilizationBg(squad.utilizationPct))}
                        style={{ width: `${Math.min(squad.utilizationPct, 100)}%` }}
                      />
                      {squad.utilizationPct > 100 && (
                        <div className="absolute inset-0 bg-destructive/20 rounded-full" />
                      )}
                    </div>
                    {/* Estimation marker */}
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Planejamento</span>
                      <span className="font-semibold text-muted-foreground">{squad.estimationPct}%</span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/40 transition-all"
                        style={{ width: `${Math.min(squad.estimationPct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Member roles breakdown */}
                  <div className="flex flex-wrap gap-1.5">
                    {["Líder Técnico", "Dev Back-end", "Dev Front-end", "Arquiteto", "QA"].map((role) => {
                      const count = squad.members.filter((m) => m.role === role).length;
                      if (count === 0) return null;
                      const ftePart = squad.members.filter((m) => m.role === role).reduce((s, m) => s + m.allocation, 0);
                      return (
                        <span key={role} className="rounded-full px-2 py-0.5 text-[9px] bg-muted text-muted-foreground">
                          {role}: {count} ({ftePart.toFixed(1)} FTE)
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
};

export default Capacity;
