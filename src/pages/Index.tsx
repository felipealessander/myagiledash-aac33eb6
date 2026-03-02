import { Clock, ListTodo, AlertTriangle, TrendingUp, Users, BarChart3, Receipt } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TeamCard } from "@/components/dashboard/TeamCard";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { EstimationVsSpentChart } from "@/components/dashboard/EstimationVsSpentChart";
import { TaskTable } from "@/components/dashboard/TaskTable";
import { TeamDistributionChart } from "@/components/dashboard/TeamDistributionChart";
import { BillingOverviewChart } from "@/components/dashboard/BillingOverviewChart";
import { BillingComparisonChart } from "@/components/dashboard/BillingComparisonChart";
import { BillingKpiCards } from "@/components/dashboard/BillingKpiCards";
import { teams, totalEstimated, totalSpent, totalTasks } from "@/data/dashboardData";

const Index = () => {
  const overrun = (((totalSpent - totalEstimated) / totalEstimated) * 100).toFixed(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Sprint Dashboard</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Gestão Ágil de Times</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {teams.map(t => {
              const dotClass: Record<string, string> = {
                NaN: "bg-team-nan",
                "Golden Gate": "bg-team-golden-gate",
                Code418: "bg-team-code418",
                Tesseract: "bg-team-tesseract",
              };
              return (
                <span key={t.name} className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-secondary-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${dotClass[t.name]}`} />
                  {t.name}
                </span>
              );
            })}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Horas Realizadas"
            value={`${totalSpent.toFixed(0)}h`}
            subtitle="Total de horas registradas"
            icon={Clock}
            variant="primary"
            delay={0}
          />
          <KpiCard
            title="Horas Estimadas"
            value={`${totalEstimated.toFixed(0)}h`}
            subtitle="Total previsto nas tarefas"
            icon={TrendingUp}
            variant="info"
            delay={50}
          />
          <KpiCard
            title="Total de Tarefas"
            value={totalTasks}
            subtitle="Itens rastreados no período"
            icon={ListTodo}
            variant="default"
            delay={100}
          />
          <KpiCard
            title="Desvio de Estimativa"
            value={`+${overrun}%`}
            subtitle="Horas além do estimado"
            icon={AlertTriangle}
            variant="warning"
            trend={{ value: -12, label: "vs sprint anterior" }}
            delay={150}
          />
        </div>

        {/* Team Cards */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Visão por Time
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {teams.map((team, i) => (
              <TeamCard key={team.name} team={team} delay={200 + i * 50} />
            ))}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CategoryChart />
          <EstimationVsSpentChart />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TeamDistributionChart />
          <TaskTable />
        </div>

        {/* Billing Section */}
        <div className="pt-2">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Classificação de Faturamento
          </h2>
          <BillingKpiCards />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BillingOverviewChart />
          <BillingComparisonChart />
        </div>
      </main>
    </div>
  );
};

export default Index;
