import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Loader2, Cloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const YEARS = Array.from({ length: 5 }, (_, i) => {
  const y = new Date().getFullYear() - 2 + i;
  return { value: String(y), label: String(y) };
});

interface YouTrackSyncDialogProps {
  onImported: () => void;
}

type SyncPhase = "idle" | "fetching" | "saving" | "done";

export function YouTrackSyncDialog({ onImported }: YouTrackSyncDialogProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [project, setProject] = useState("ATT");
  const [syncing, setSyncing] = useState(false);
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState("");
  const { toast } = useToast();

  const handleSync = async () => {
    if (!month || !year) {
      toast({ title: "Selecione mês e ano", variant: "destructive" });
      return;
    }

    setSyncing(true);
    setPhase("fetching");
    setProgress(10);
    setPhaseLabel("Buscando tarefas no YouTrack...");

    try {
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      const dateFrom = `${year}-${month}-01`;
      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      const dateTo = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/youtrack?project=${encodeURIComponent(project)}&dateFrom=${dateFrom}&dateTo=${dateTo}`;

      setProgress(20);

      const response = await fetch(url);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      setProgress(50);
      setPhaseLabel("Processando resposta...");

      const result = await response.json();
      const tasks = result.tasks;

      if (!tasks || tasks.length === 0) {
        toast({ title: "Nenhuma tarefa encontrada no período", variant: "destructive" });
        setSyncing(false);
        setPhase("idle");
        setProgress(0);
        return;
      }

      // Save to database
      setPhase("saving");
      setProgress(55);
      setPhaseLabel(`Salvando ${tasks.length} tarefas no banco...`);

      const monthKey = `${year}-${month}`;
      const monthLabel = `${MONTHS.find(m => m.value === month)?.label} ${year}`;

      const { data: report, error: reportError } = await supabase
        .from("sprint_reports")
        .upsert({ month: monthKey, label: monthLabel }, { onConflict: "month" })
        .select("id")
        .single();

      if (reportError) throw reportError;

      setProgress(60);

      await supabase.from("report_tasks").delete().eq("report_id", report.id);

      setProgress(65);

      const batchSize = 100;
      const totalBatches = Math.ceil(tasks.length / batchSize);

      for (let i = 0; i < tasks.length; i += batchSize) {
        const batchIndex = Math.floor(i / batchSize);
        const batchProgress = 65 + Math.round((batchIndex / totalBatches) * 30);
        setProgress(batchProgress);
        setPhaseLabel(`Salvando lote ${batchIndex + 1}/${totalBatches} (${Math.min(i + batchSize, tasks.length)}/${tasks.length} tarefas)...`);

        const batch = tasks.slice(i, i + batchSize).map((t: any) => ({
          report_id: report.id,
          task_code: t.taskCode,
          title: t.title,
          category: t.category,
          billing_status: t.billingStatus,
          squad: t.squad,
          assignee: t.assignee,
          estimated_minutes: t.estimatedMinutes,
          spent_minutes: t.spentMinutes,
          status: t.status,
          created_at_yt: t.createdAt,
          resolved_at: t.resolvedAt,
          started_at: t.startedAt,
        }));

        const { error } = await supabase.from("report_tasks").insert(batch);
        if (error) throw error;
      }

      setPhase("done");
      setProgress(100);
      setPhaseLabel("Sincronização concluída!");

      const squads = new Set(tasks.map((t: any) => t.squad));

      toast({
        title: "Sincronização concluída!",
        description: `${tasks.length} tarefas importadas do YouTrack para ${monthLabel} (${squads.size} squads)`,
      });

      setTimeout(() => {
        setOpen(false);
        setMonth("");
        setPhase("idle");
        setProgress(0);
        onImported();
      }, 800);
    } catch (err: any) {
      console.error("YouTrack sync error:", err);
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
      setPhase("idle");
      setProgress(0);
    } finally {
      setSyncing(false);
    }
  };

  const phasePercentage = Math.round(progress);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!syncing) setOpen(v); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Cloud className="h-3.5 w-3.5" />
          Sincronizar YouTrack
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Sincronizar com YouTrack
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Mês</Label>
              <Select value={month} onValueChange={setMonth} disabled={syncing}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Ano</Label>
              <Select value={year} onValueChange={setYear} disabled={syncing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => (
                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Projeto YouTrack</Label>
            <Input value={project} onChange={e => setProject(e.target.value)} placeholder="ATT" disabled={syncing} />
            <p className="text-[10px] text-muted-foreground">ShortName do projeto (prefixo das issues)</p>
          </div>

          {/* Progress indicator */}
          {phase !== "idle" && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{phaseLabel}</span>
                <span className="font-mono font-semibold text-primary">{phasePercentage}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Button onClick={handleSync} disabled={syncing} className="w-full gap-2">
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Sincronizar Dados
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
