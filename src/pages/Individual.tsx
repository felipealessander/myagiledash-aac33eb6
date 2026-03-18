import { useEffect, useMemo } from "react";
import { Loader2, LogOut, CheckCircle, Clock, RotateCcw, User } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { useIndividualData } from "@/hooks/useIndividualData";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Individual = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  const { months, selectedMonth, setSelectedMonth } = useDashboardData();
  const { devMetrics, loading } = useIndividualData(selectedMonth, months);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 pl-10">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Desempenho Individual</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MonthSelector months={months} selected={selectedMonth} onSelect={setSelectedMonth} />
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs">
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : devMetrics.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Nenhum dado disponível para o período selecionado.
          </div>
        ) : (
          <div className="grid gap-4">
            {devMetrics.map((dev, idx) => (
              <Card key={dev.name} className="opacity-0 animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    {dev.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <KpiCard
                      title="Cards Concluídos"
                      value={dev.completedTasks}
                      subtitle={`de ${dev.totalTasks} trabalhados`}
                      icon={CheckCircle}
                      variant="primary"
                      delay={idx * 50 + 100}
                    />
                    <KpiCard
                      title="Horas Registradas"
                      value={`${dev.spentHours.toFixed(1)}h`}
                      subtitle={`Estimado: ${dev.estimatedHours.toFixed(1)}h`}
                      icon={Clock}
                      variant="info"
                      delay={idx * 50 + 150}
                    />
                    <KpiCard
                      title="Retrabalho"
                      value={dev.reworkCount}
                      subtitle={`${dev.reworkRate.toFixed(1)}% dos cards`}
                      icon={RotateCcw}
                      variant={dev.reworkRate > 20 ? "destructive" : dev.reworkRate > 10 ? "warning" : "default"}
                      delay={idx * 50 + 200}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Individual;
