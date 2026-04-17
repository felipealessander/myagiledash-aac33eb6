import { useEffect, useState, useMemo } from "react";
import { Loader2, LogOut, CheckCircle, Clock, RotateCcw, User, Users, X, Search } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useIndividualData } from "@/hooks/useIndividualData";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Individual = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { canViewIndividual, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [selectedDevs, setSelectedDevs] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) navigate("/auth");
      else if (!canViewIndividual) navigate("/");
    }
  }, [authLoading, roleLoading, user, canViewIndividual, navigate]);

  const { months, selectedMonth, setSelectedMonth } = useDashboardData();
  const { devMetrics, allDevNames, loading } = useIndividualData(selectedMonth, months);

  const filteredMetrics = useMemo(() => {
    if (selectedDevs.length === 0) return devMetrics;
    return devMetrics.filter(d => selectedDevs.includes(d.name));
  }, [devMetrics, selectedDevs]);

  const toggleDev = (key: string) => {
    setSelectedDevs(prev =>
      prev.includes(key) ? prev.filter(n => n !== key) : [...prev, key]
    );
  };

  const getDisplayName = (key: string) => {
    const found = allDevNames.find(d => d.key === key);
    return found ? found.display : key;
  };

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
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Users className="h-3.5 w-3.5" />
                  {selectedDevs.length === 0
                    ? "Todos os devs"
                    : `${selectedDevs.length} selecionado${selectedDevs.length > 1 ? "s" : ""}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Selecionar devs</span>
                  {selectedDevs.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setSelectedDevs([])}
                    >
                      Limpar
                    </Button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                  {allDevNames.map(({ key, display }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedDevs.includes(key)}
                        onCheckedChange={() => toggleDev(key)}
                      />
                      <span className="truncate">{display}</span>
                    </label>
                  ))}
                  {allDevNames.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">Nenhum dev encontrado</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs">
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {selectedDevs.length > 0 && (
        <div className="container mx-auto px-4 pt-4 flex flex-wrap gap-2">
          {selectedDevs.map(key => (
            <Badge key={key} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => toggleDev(key)}>
              {getDisplayName(key)}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      <main className="container mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredMetrics.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Nenhum dado disponível para o período selecionado.
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredMetrics.map((dev, idx) => (
              <Card key={dev.name} className="opacity-0 animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    {dev.displayName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="cursor-pointer">
                          <KpiCard
                            title="Cards Trabalhados"
                            value={dev.totalTasks}
                            subtitle={`${dev.completedTasks} concluídos · clique para ver`}
                            icon={CheckCircle}
                            variant="primary"
                            delay={idx * 50 + 100}
                          />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="start" className="p-0 w-80">
                        <ScrollArea className="max-h-72">
                          <div className="p-3 space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                              Cards ({dev.taskCards.length})
                            </p>
                            {dev.taskCards.map((tc, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs py-1.5 border-b border-border last:border-0">
                                <span className="font-mono font-medium text-primary shrink-0">{tc.task_code}</span>
                                <span className="text-foreground line-clamp-2">{tc.title || "—"}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <KpiCard
                      title="Horas Registradas"
                      value={`${dev.spentHours.toFixed(1)}h`}
                      subtitle={`Estimado: ${dev.estimatedHours.toFixed(1)}h`}
                      icon={Clock}
                      variant="info"
                      delay={idx * 50 + 150}
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="cursor-pointer">
                          <KpiCard
                            title="Retrabalho"
                            value={dev.reworkCount}
                            subtitle={`${dev.reworkRate.toFixed(1)}% dos cards · clique para ver`}
                            icon={RotateCcw}
                            variant={dev.reworkRate > 20 ? "destructive" : dev.reworkRate > 10 ? "warning" : "default"}
                            delay={idx * 50 + 200}
                          />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="start" className="p-0 w-80">
                        <ScrollArea className="max-h-72">
                          <div className="p-3 space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                              Cards com retrabalho ({dev.reworkCards.length})
                            </p>
                            {dev.reworkCards.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-3">Nenhum card com retrabalho</p>
                            ) : (
                              dev.reworkCards.map((tc, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs py-1.5 border-b border-border last:border-0">
                                  <span className="font-mono font-medium text-primary shrink-0">{tc.task_code}</span>
                                  <span className="text-foreground line-clamp-2">{tc.title || "—"}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
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
