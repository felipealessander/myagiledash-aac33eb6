import { useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { Clock, ListTodo, AlertTriangle, TrendingUp, Users, BarChart3, Receipt, Loader2, LogOut, Gauge, RotateCcw } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TeamCard } from "@/components/dashboard/TeamCard";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { EstimationVsSpentChart } from "@/components/dashboard/EstimationVsSpentChart";
import { TaskTable } from "@/components/dashboard/TaskTable";
import { TeamDistributionChart } from "@/components/dashboard/TeamDistributionChart";
import { BillingOverviewChart } from "@/components/dashboard/BillingOverviewChart";
import { BillingComparisonChart } from "@/components/dashboard/BillingComparisonChart";
import { BillingKpiCards } from "@/components/dashboard/BillingKpiCards";
import { LeadTimeChart } from "@/components/dashboard/LeadTimeChart";
import { ThroughputChart } from "@/components/dashboard/ThroughputChart";
import { WIPChart } from "@/components/dashboard/WIPChart";
import { CycleTimeChart } from "@/components/dashboard/CycleTimeChart";
import { ReworkChart } from "@/components/dashboard/ReworkChart";
import { IncidentsByClientChart } from "@/components/dashboard/IncidentsByClientChart";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { MonthlyTrendCharts } from "@/components/dashboard/MonthlyTrendCharts";
import { YouTrackSyncDialog } from "@/components/dashboard/YouTrackSyncDialog";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { LastSyncBadge } from "@/components/dashboard/LastSyncBadge";
import { ShieldAlert } from "lucide-react";

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { approved, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { months, selectedMonth, setSelectedMonth, dashboardData, allTeams, loading, refetchMonths, selectedSquad, setSelectedSquad, monthlyTrend, isYearView } = useDashboardData();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Show pending approval message
  if (!authLoading && !roleLoading && user && !approved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <ShieldAlert className="h-12 w-12 text-warning mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Acesso Pendente</h2>
          <p className="text-muted-foreground text-sm">
            Sua conta foi criada, mas ainda precisa ser aprovada por um administrador. 
            Você será notificado quando o acesso for liberado.
          </p>
          <Button variant="outline" onClick={signOut}>Sair</Button>
        </div>
      </div>
    );
  }
  const { teams, categoryTotals, billingData, totalSpent, totalEstimated, totalTasks, billingTotalSpent, leadTimeBySquad, cycleTimeBySquad, throughputByWeek, wipBySquad, reworkCount, reworkTotalCorrections, reworkRate, reworkBySquad, incidentsCreatedInMonth, incidentsByClient } = dashboardData;

  const overrun = totalEstimated > 0 ? (((totalSpent - totalEstimated) / totalEstimated) * 100).toFixed(0) : "0";

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 pl-10">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Métricas Desenv</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LastSyncBadge />
            <MonthSelector months={months} selected={selectedMonth} onSelect={setSelectedMonth} />
            <YouTrackSyncDialog onImported={refetchMonths} />
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs">
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
            <div className="hidden lg:flex items-center gap-2">
              {allTeams.map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => setSelectedSquad(selectedSquad === t.name ? null : t.name)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all cursor-pointer border ${
                    selectedSquad === t.name
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : selectedSquad === null
                        ? "bg-secondary text-secondary-foreground border-transparent hover:border-border"
                        : "bg-muted/50 text-muted-foreground border-transparent hover:border-border opacity-60"
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: t.color.startsWith("var(") ? undefined : t.color }}
                    {...(t.color.startsWith("var(") ? { className: `h-1.5 w-1.5 rounded-full bg-muted-foreground` } : {})}
                  />
                  {t.name}
                </button>
              ))}
              {selectedSquad && (
                <button
                  onClick={() => setSelectedSquad(null)}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <main className="container mx-auto px-4 py-6 space-y-8">

          {/* ═══════ PRODUTO ═══════ */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Produto
            </h2>
            <div className="space-y-4">
              {/* KPIs de Produto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Horas Realizadas" value={`${totalSpent.toFixed(0)}h`} subtitle="Total de horas registradas" icon={Clock} variant="primary" delay={0} />
                <KpiCard title="Horas Estimadas" value={`${totalEstimated.toFixed(0)}h`} subtitle="Total previsto nas tarefas" icon={TrendingUp} variant="info" delay={50} />
                <KpiCard title="Total de Tarefas" value={totalTasks} subtitle="Itens rastreados no período" icon={ListTodo} variant="default" delay={100} />
                <KpiCard title="Desvio de Estimativa" value={`${Number(overrun) >= 0 ? "+" : ""}${overrun}%`} subtitle="Horas além do estimado" icon={AlertTriangle} variant="warning" delay={150} />
              </div>

              {/* Visão por Time */}
              <div>
                <h3 className="text-xs font-medium mb-3 flex items-center gap-2 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Visão por Time
                </h3>
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${teams.length <= 4 ? 'lg:grid-cols-4' : teams.length <= 6 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
                  {teams.map((team, i) => (
                    <TeamCard key={team.name} team={team} teamIndex={i} delay={200 + i * 50} />
                  ))}
                </div>
              </div>

              {/* Gráficos de Produto */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CategoryChart categoryTotals={categoryTotals} />
                <EstimationVsSpentChart teams={teams} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TeamDistributionChart teams={teams} />
                <TaskTable categoryTotals={categoryTotals} />
              </div>
            </div>
          </section>

          {/* ═══════ EVOLUÇÃO MENSAL (só no ano consolidado) ═══════ */}
          {isYearView && monthlyTrend.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Evolução Mensal
              </h2>
              <MonthlyTrendCharts data={monthlyTrend} />
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Incidentes
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Incidentes Criados" value={incidentsCreatedInMonth} subtitle="Criados no período selecionado" icon={AlertTriangle} variant="destructive" delay={0} />
                <KpiCard title="Tarefas com Retrabalho" value={reworkCount} subtitle={`${reworkRate}% do total`} icon={RotateCcw} variant="destructive" delay={50} />
                <KpiCard title="Total de Correções" value={reworkTotalCorrections} subtitle="Soma de correções aplicadas" icon={RotateCcw} variant="warning" delay={100} />
                <KpiCard title="Correções / Tarefa" value={reworkCount > 0 ? (reworkTotalCorrections / reworkCount).toFixed(1) : "0"} subtitle="Média por tarefa retrabalhada" icon={RotateCcw} variant="info" delay={150} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ReworkChart data={reworkBySquad || []} />
                <IncidentsByClientChart data={incidentsByClient || []} />
              </div>
            </div>
          </section>

          {/* ═══════ MÉTRICAS ÁGEIS ═══════ */}
          {selectedMonth !== "static" && (leadTimeBySquad?.length > 0 || cycleTimeBySquad?.length > 0 || throughputByWeek?.length > 0 || wipBySquad?.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Métricas Ágeis
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard
                    title="Lead Time Médio"
                    value={`${leadTimeBySquad.length > 0 ? (leadTimeBySquad.reduce((s, l) => s + l.avg * l.count, 0) / Math.max(1, leadTimeBySquad.reduce((s, l) => s + l.count, 0))).toFixed(1) : "0"}d`}
                    subtitle={`P85: ${leadTimeBySquad.length > 0 ? (leadTimeBySquad.reduce((s, l) => s + l.p85 * l.count, 0) / Math.max(1, leadTimeBySquad.reduce((s, l) => s + l.count, 0))).toFixed(1) : "0"}d · Criação → Conclusão`}
                    icon={Clock}
                    variant="info"
                    delay={0}
                  />
                  <KpiCard
                    title="Cycle Time Médio"
                    value={`${cycleTimeBySquad.length > 0 ? (cycleTimeBySquad.reduce((s, l) => s + l.avg * l.count, 0) / Math.max(1, cycleTimeBySquad.reduce((s, l) => s + l.count, 0))).toFixed(1) : "0"}d`}
                    subtitle={`P85: ${cycleTimeBySquad.length > 0 ? (cycleTimeBySquad.reduce((s, l) => s + l.p85 * l.count, 0) / Math.max(1, cycleTimeBySquad.reduce((s, l) => s + l.count, 0))).toFixed(1) : "0"}d · Em andamento → Conclusão`}
                    icon={Gauge}
                    variant="primary"
                    delay={50}
                  />
                  <KpiCard
                    title="Throughput Médio"
                    value={`${throughputByWeek.length > 0 ? (throughputByWeek.reduce((s, w) => s + w.count, 0) / throughputByWeek.length).toFixed(1) : "0"}/sem`}
                    subtitle="Tarefas resolvidas por semana"
                    icon={TrendingUp}
                    variant="default"
                    delay={100}
                  />
                  <KpiCard
                    title="WIP Total"
                    value={wipBySquad.reduce((s, w) => s + w.wip, 0)}
                    subtitle="Tarefas em andamento"
                    icon={ListTodo}
                    variant="warning"
                    delay={150}
                  />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <LeadTimeChart data={leadTimeBySquad || []} />
                  <CycleTimeChart data={cycleTimeBySquad || []} />
                </div>
                {monthlyTrend.length > 1 && (
                  <div className="gradient-card rounded-lg border border-border p-5">
                    <h3 className="text-sm font-semibold mb-1">Lead Time & Cycle Time – Evolução Mensal</h3>
                    <p className="text-xs text-muted-foreground mb-4">Evolução mensal da previsibilidade (dias)</p>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyTrend.map(d => ({ ...d, shortLabel: d.label.slice(0, 3) }))} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="shortLabel" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="d" />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px", color: "hsl(var(--foreground))" }}
                            formatter={(v: number, name: string) => [`${v}d`, name === "leadTimeAvg" ? "Lead Time" : "Cycle Time"]}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v) => v === "leadTimeAvg" ? "Lead Time" : "Cycle Time"} />
                          <Line dataKey="leadTimeAvg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                          <Line dataKey="cycleTimeAvg" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ThroughputChart data={throughputByWeek || []} />
                  <WIPChart data={wipBySquad || []} />
                </div>
              </div>
            </section>
          )}

          {/* ═══════ FATURAMENTO ═══════ */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <Receipt className="h-4 w-4" />
              Faturamento
            </h2>
            <div className="space-y-4">
              <BillingKpiCards billingData={billingData} billingTotalSpent={billingTotalSpent} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BillingOverviewChart billingData={billingData} billingTotalSpent={billingTotalSpent} />
                <BillingComparisonChart billingData={billingData} />
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
};

export default Index;
