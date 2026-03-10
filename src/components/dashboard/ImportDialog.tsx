import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mergeReports } from "@/lib/xlsxParser";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safeError";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TASK_CODE_LENGTH = 50;
const MAX_TEXT_LENGTH = 500;

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

interface ImportDialogProps {
  onImported: () => void;
}

interface FileUploadAreaProps {
  label: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  optional?: boolean;
}

function FileUploadArea({ label, description, file, onFileChange, optional }: FileUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label className="text-xs">
        {label} {optional && <span className="text-muted-foreground font-normal">(opcional)</span>}
      </Label>
      <p className="text-[10px] text-muted-foreground">{description}</p>
      <div
        className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        />
        {file ? (
          <p className="text-xs text-primary font-medium">{file.name}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Clique para selecionar</p>
        )}
      </div>
    </div>
  );
}

export function ImportDialog({ onImported }: ImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [categoryFile, setCategoryFile] = useState<File | null>(null);
  const [billingFile, setBillingFile] = useState<File | null>(null);
  const [squadFile, setSquadFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    if (!month || !year || !categoryFile || !billingFile) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    // Validate file sizes
    const allFiles = [categoryFile, billingFile, squadFile].filter(Boolean) as File[];
    for (const f of allFiles) {
      if (f.size > MAX_FILE_SIZE) {
        toast({ title: `Arquivo "${f.name}" excede o limite de 10MB`, variant: "destructive" });
        return;
      }
    }

    setImporting(true);

    try {
      const filePromises = [categoryFile.arrayBuffer(), billingFile.arrayBuffer()];
      if (squadFile) filePromises.push(squadFile.arrayBuffer());
      
      const buffers = await Promise.all(filePromises);
      const [catBuf, billBuf] = buffers;
      const squadBuf = buffers[2] || undefined;

      const tasks = mergeReports(catBuf, billBuf, squadBuf);

      if (tasks.length === 0) {
        toast({ title: "Nenhuma tarefa encontrada nos arquivos", variant: "destructive" });
        setImporting(false);
        return;
      }

      // Validate and sanitize task data
      const sanitize = (s: string, max: number) => (s || "").slice(0, max).trim();
      const clampNum = (n: number) => Math.max(0, Math.min(n, 999999));

      const monthKey = `${year}-${month}`;
      const monthLabel = `${MONTHS.find(m => m.value === month)?.label} ${year}`;

      const { data: report, error: reportError } = await supabase
        .from("sprint_reports")
        .upsert({ month: monthKey, label: monthLabel, sync_type: 'manual' }, { onConflict: "month" })
        .select("id")
        .single();

      if (reportError) throw reportError;

      await supabase.from("report_tasks").delete().eq("report_id", report.id);

      const batchSize = 100;
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize).map(t => ({
          report_id: report.id,
          task_code: sanitize(t.taskCode, MAX_TASK_CODE_LENGTH),
          title: sanitize(t.title, MAX_TEXT_LENGTH),
          category: sanitize(t.category, 100),
          billing_status: sanitize(t.billingStatus, 100),
          squad: sanitize(t.squad, 100),
          estimated_minutes: clampNum(t.estimatedMinutes),
          spent_minutes: clampNum(t.spentMinutes),
        }));

        const { error } = await supabase.from("report_tasks").insert(batch);
        if (error) throw error;
      }

      // Count unique squads
      const squads = new Set(tasks.map(t => t.squad));

      toast({
        title: "Importação concluída!",
        description: `${tasks.length} tarefas importadas para ${monthLabel} (${squads.size} squads)`,
      });

      setOpen(false);
      setCategoryFile(null);
      setBillingFile(null);
      setSquadFile(null);
      setMonth("");
      onImported();
    } catch (err: unknown) {
      console.error("Import error:", err);
      toast({ title: "Erro na importação", description: getSafeErrorMessage(err), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-3.5 w-3.5" />
          Importar Sprint
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Relatório de Sprint
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Mês</Label>
              <Select value={month} onValueChange={setMonth}>
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
              <Select value={year} onValueChange={setYear}>
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

          <FileUploadArea
            label="Relatório por Categoria (.xlsx)"
            description="Arquivo com tarefas agrupadas por tipo (Atendimento, Tarefa, etc.)"
            file={categoryFile}
            onFileChange={setCategoryFile}
          />

          <FileUploadArea
            label="Relatório por Faturamento (.xlsx)"
            description="Arquivo com tarefas agrupadas por status de faturamento"
            file={billingFile}
            onFileChange={setBillingFile}
          />

          <FileUploadArea
            label="Relatório por Squad (.xlsx)"
            description="Arquivo com tarefas agrupadas por squad/time. Squads novas serão criadas automaticamente."
            file={squadFile}
            onFileChange={setSquadFile}
            optional
          />

          <Button onClick={handleImport} disabled={importing} className="w-full gap-2">
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Importar Dados
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
