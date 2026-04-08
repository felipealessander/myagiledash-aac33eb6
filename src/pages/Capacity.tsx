import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCapacityData } from "@/hooks/useCapacityData";
import { ROLE_HOURS_PER_DAY } from "@/data/squadCapacity";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart3, Users, Clock, TrendingUp, Loader2, ShieldAlert, Gauge, AlertTriangle, TrendingDown, Activity, Calendar, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { getTeamColor } from "@/data/dashboardData";

const SQUAD_COUNT = 7;

const Capacity = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { approved, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { months, selectedMonth, setSelectedMonth, summaries, avg3mSummaries, totals, avg3mTotals, loading, workingDays } = useCapacityData();

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

  const getDeviationVariant = (deviation: number) => {
    if (deviation > 0) return "destructive" as const;
    if (deviation < -50) return "warning" as const;
    return "default" as const;
  };

  const chartData = summaries.map((s) => {
    const avg = avg3mSummaries.find((a) => a.name === s.name);
    return {
      name: s.name,
      capacidade: s.capacityHours,
      realizado: s.spentHours,
      media3m: avg?.spentHours ?? 0,
    };
  });

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
              <p className="text-[10px] text-muted-foreground">Quanto seu time pode entregar vs quanto está entregando</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {workingDays} dias úteis
            </span>
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

          {/* ═══════ RESUMO EXECUTIVO ═══════ */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <Gauge className="h-4 w-4" />
              Resumo Executivo
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <KpiCard
                title="Pessoas"
                value={`${totals.fte.toFixed(1)} FTE`}
                subtitle={`${totals.members} pessoas · ${SQUAD_COUNT} squads`}
                icon={Users}
                variant="primary"
                delay={0}
              />
              <KpiCard
                title="Capacidade Mensal"
                value={`${totals.capacity}h`}
                subtitle={`${workingDays} dias úteis × horas/papel`}
                icon={Clock}
                variant="info"
                delay={50}
              />
              <KpiCard
                title="Horas Registradas"
                value={`${totals.spent}h`}
                subtitle={`${totals.utilizationPct}% da capacidade`}
                icon={TrendingUp}
                variant={totals.utilizationPct > 100 ? "destructive" : totals.utilizationPct > 85 ? "warning" : "default"}
                delay={100}
              />
              <KpiCard
                title="Dedicado a Produto"
                value={`${totals.productSpent}h`}
                subtitle={`${totals.productPct}% do tempo registrado`}
                icon={Package}
                variant="primary"
                delay={125}
              />
              <KpiCard
                title="Desvio"
                value={`${totals.deviation > 0 ? "+" : ""}${totals.deviation}h`}
                subtitle={totals.deviation > 0 ? "Acima da capacidade" : "Abaixo da capacidade"}
                icon={totals.deviation > 0 ? AlertTriangle : TrendingDown}
                variant={getDeviationVariant(totals.deviation)}
                delay={150}
              />
              <KpiCard
                title="Média 3 Meses"
                value={`${avg3mTotals.spent}h`}
                subtitle={`${avg3mTotals.utilizationPct}% utilização média`}
                icon={Activity}
                variant="default"
                delay={200}
              />
            </div>

            {/* Premissas */}
            <div className="mt-3 flex flex-wrap gap-3 text-[9px] text-muted-foreground">
              <span className="bg-muted rounded px-2 py-1">Líder Técnico: {ROLE_HOURS_PER_DAY["Líder Técnico"]}h/dia</span>
              <span className="bg-muted rounded px-2 py-1">Dev Back-end: {ROLE_HOURS_PER_DAY["Dev Back-end"]}h/dia</span>
              <span className="bg-muted rounded px-2 py-1">Dev Front-end: {ROLE_HOURS_PER_DAY["Dev Front-end"]}h/dia</span>
              <span className="bg-muted rounded px-2 py-1">Arquiteto: {ROLE_HOURS_PER_DAY["Arquiteto"]}h/dia</span>
              <span className="bg-muted rounded px-2 py-1">QA: {ROLE_HOURS_PER_DAY["QA"]}h/dia</span>
            </div>
          </section>

          {/* ═══════ GRÁFICO COMPARATIVO ═══════ */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Capacidade vs Registrado por Squad
            </h2>
            <div className="gradient-card rounded-lg border border-border p-5">
              <p className="text-xs text-muted-foreground mb-4">
                Cinza = capacidade · Azul = horas registradas · Amarelo = média últimos 3 meses
              </p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="h" />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px", color: "hsl(var(--foreground))" }}
                      formatter={(v: number, name: string) => {
                        const labels: Record<string, string> = { capacidade: "Capacidade", realizado: "Registrado", media3m: "Média 3m" };
                        return [`${Math.round(v)}h`, labels[name] || name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v) => {
                      const labels: Record<string, string> = { capacidade: "Capacidade", realizado: "Horas Registradas", media3m: "Média 3 Meses" };
                      return labels[v] || v;
                    }} />
                    <Bar dataKey="capacidade" fill="hsl(var(--muted-foreground))" opacity={0.25} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="media3m" fill="hsl(var(--warning))" opacity={0.5} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* ═══════ DETALHAMENTO POR SQUAD ═══════ */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <Users className="h-4 w-4" />
              Detalhamento por Squad
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {summaries.map((squad, i) => {
                const avg = avg3mSummaries.find((a) => a.name === squad.name);
                const deviation = squad.spentHours - squad.capacityHours;
                const deviationPct = squad.capacityHours > 0 ? ((deviation / squad.capacityHours) * 100).toFixed(1) : "0";

                return (
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
                        <TooltipContent side="bottom" className="max-w-[300px]">
                          <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Dedicados</p>
                          <ul className="space-y-0.5">
                            {squad.members.filter(m => !m.cross).map((m) => (
                              <li key={m.name} className="text-xs flex justify-between gap-4">
                                <span>{m.name}</span>
                                <span className="text-muted-foreground">{m.role} · {ROLE_HOURS_PER_DAY[m.role]}h/dia</span>
                              </li>
                            ))}
                          </ul>
                          {squad.members.some(m => m.cross) && (
                            <>
                              <p className="text-[10px] font-semibold mt-2 mb-1 text-muted-foreground uppercase tracking-wider">Cross-squad</p>
                              <ul className="space-y-0.5">
                                {squad.members.filter(m => m.cross).map((m) => (
                                  <li key={m.name} className="text-xs flex justify-between gap-4">
                                    <span>{m.name}</span>
                                    <span className="text-muted-foreground">{m.role} · {Math.round(m.allocation * 100)}% · {(ROLE_HOURS_PER_DAY[m.role] * m.allocation).toFixed(1)}h/dia</span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Core metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Pode trabalhar</span>
                        <p className="text-xl font-bold font-mono">{squad.capacityHours}h</p>
                        <p className="text-[10px] text-muted-foreground">{workingDays} dias × papel</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Trabalhou</span>
                        <p className="text-xl font-bold font-mono">{squad.spentHours}h</p>
                        <p className={cn("text-[10px] font-medium", getUtilizationColor(squad.utilizationPct))}>
                          {squad.utilizationPct}% da capacidade
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Package className="h-3 w-3" /> Produto
                        </span>
                        <p className="text-xl font-bold font-mono">{squad.productSpentHours}h</p>
                        <p className="text-[10px] text-muted-foreground">
                          {squad.productPct}% do registrado
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Desvio</span>
                        <p className={cn("text-xl font-bold font-mono", deviation > 0 ? "text-destructive" : deviation < -50 ? "text-warning" : "text-primary")}>
                          {deviation > 0 ? "+" : ""}{deviation}h
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {deviation > 0 ? "sobrecarregado" : "capacidade disponível"} ({deviationPct}%)
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Média 3 meses</span>
                        <p className="text-xl font-bold font-mono">{avg?.spentHours ?? 0}h</p>
                        <p className="text-[10px] text-muted-foreground">
                          {avg ? `${avg.utilizationPct}% utilização` : "sem dados"}
                        </p>
                      </div>
                    </div>

                    {/* Utilization bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Utilização da capacidade</span>
                        <span className={cn("font-semibold", getUtilizationColor(squad.utilizationPct))}>{squad.utilizationPct}%</span>
                      </div>
                      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", getUtilizationBg(squad.utilizationPct))}
                          style={{ width: `${Math.min(squad.utilizationPct, 100)}%` }}
                        />
                        {squad.utilizationPct > 100 && (
                          <div className="absolute inset-0 bg-destructive/20 rounded-full" />
                        )}
                        {avg && avg.utilizationPct > 0 && (
                          <div
                            className="absolute top-0 h-full w-0.5 bg-warning"
                            style={{ left: `${Math.min(avg.utilizationPct, 100)}%` }}
                            title={`Média 3m: ${avg.utilizationPct}%`}
                          />
                        )}
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span>0%</span>
                        {avg && avg.utilizationPct > 0 && (
                          <span className="text-warning">▲ Média 3m: {avg.utilizationPct}%</span>
                        )}
                        <span>100%</span>
                      </div>
                    </div>

                    {/* Role breakdown */}
                    <div className="flex flex-wrap gap-1.5">
                      {(["Líder Técnico", "Dev Back-end", "Dev Front-end", "Arquiteto", "QA"] as const).map((role) => {
                        const roleMembers = squad.members.filter((m) => m.role === role);
                        if (roleMembers.length === 0) return null;
                        const fte = roleMembers.reduce((s, m) => s + m.allocation, 0);
                        return (
                          <span key={role} className="rounded-full px-2 py-0.5 text-[9px] bg-muted text-muted-foreground">
                            {role}: {roleMembers.length} ({fte.toFixed(1)} FTE)
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      )}
    </div>
  );
};

export default Capacity;
