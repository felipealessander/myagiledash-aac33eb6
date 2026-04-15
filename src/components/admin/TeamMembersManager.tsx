import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Pencil, Trash2, Users2 } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  username: string;
  email: string;
  active: boolean;
  squad: string | null;
  position: string | null;
  salary: number | null;
}

interface SalaryLevel {
  id: string;
  category: string;
  position: string;
  salary_clt: number;
  salary_coop: number;
  sort_order: number;
}

const SQUADS = [
  "Golden Gate", "Tesseract", "Code418", "JRE",
  "TheBigBang", "TheBigBang-Cobrança", "Code402",
];

export function TeamMembersManager() {
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [salaryLevels, setSalaryLevels] = useState<SalaryLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSquad, setFormSquad] = useState<string>("");
  const [formPosition, setFormPosition] = useState<string>("");
  const [formSalary, setFormSalary] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [membersRes, levelsRes] = await Promise.all([
      supabase.from("team_members").select("*").order("name"),
      supabase.from("salary_levels").select("*").order("sort_order"),
    ]);
    setMembers((membersRes.data as any[]) ?? []);
    setSalaryLevels((levelsRes.data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = () => {
    setEditMember(null);
    setFormName(""); setFormUsername(""); setFormEmail("");
    setFormSquad(""); setFormPosition(""); setFormSalary("");
    setDialogOpen(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditMember(m);
    setFormName(m.name); setFormUsername(m.username); setFormEmail(m.email);
    setFormSquad(m.squad ?? ""); setFormPosition(m.position ?? "");
    setFormSalary(m.salary != null ? String(m.salary) : "");
    setDialogOpen(true);
  };

  // Auto-detect position based on salary (CLT values)
  const detectPosition = (salary: number): string | null => {
    if (!salary || salaryLevels.length === 0) return null;
    // Find the level where salary fits (closest lower or equal CLT value)
    const sorted = [...salaryLevels].sort((a, b) => a.salary_clt - b.salary_clt);
    let match: SalaryLevel | null = null;
    for (const level of sorted) {
      if (salary >= level.salary_clt) {
        match = level;
      } else {
        break;
      }
    }
    return match?.position ?? null;
  };

  const handleSalaryChange = (val: string) => {
    setFormSalary(val);
    const num = parseFloat(val.replace(",", "."));
    if (!isNaN(num) && num > 0) {
      const detected = detectPosition(num);
      if (detected) setFormPosition(detected);
    }
  };

  const handlePositionChange = (val: string) => {
    setFormPosition(val);
    // Auto-fill salary from level
    const level = salaryLevels.find(l => l.position === val);
    if (level) {
      setFormSalary(String(level.salary_clt));
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || !formUsername.trim() || !formEmail.trim()) return;
    setSaving(true);
    const payload = {
      name: formName.trim(),
      username: formUsername.trim(),
      email: formEmail.trim(),
      squad: formSquad || null,
      position: formPosition || null,
      salary: formSalary ? parseFloat(formSalary.replace(",", ".")) : null,
    };

    try {
      if (editMember) {
        const { error } = await supabase.from("team_members").update(payload).eq("id", editMember.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Membro atualizado" });
      } else {
        const { error } = await supabase.from("team_members").insert(payload as any);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Membro adicionado" });
      }
      setDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Membro removido" });
      fetchData();
    }
  };

  const formatCurrency = (val: number | null) => {
    if (val == null) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  // Group positions by category for the select
  const positionsByCategory = salaryLevels.reduce<Record<string, SalaryLevel[]>>((acc, l) => {
    if (!acc[l.category]) acc[l.category] = [];
    acc[l.category].push(l);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users2 className="h-5 w-5" />
            Membros do Time ({members.length})
          </CardTitle>
          <Button size="sm" onClick={openNew}>
            <UserPlus className="h-4 w-4 mr-2" />
            Adicionar Membro
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Squad</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Salário CLT</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="font-mono text-xs">{m.username}</TableCell>
                    <TableCell>
                      {m.squad ? (
                        <Badge variant="secondary" className="text-xs">{m.squad}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{m.position ?? "—"}</TableCell>
                    <TableCell className="text-xs">{formatCurrency(m.salary)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={m.active ? "bg-success/20 text-success text-xs" : "bg-muted text-muted-foreground text-xs"}>
                        {m.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editMember ? "Editar Membro" : "Novo Membro"}</DialogTitle>
            <DialogDescription>
              {editMember ? "Atualize as informações do membro." : "Preencha os dados do novo membro do time."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nome</label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Username</label>
                <Input value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="username" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">E-mail</label>
              <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemplo.com" type="email" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Squad</label>
              <Select value={formSquad} onValueChange={setFormSquad}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a squad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem squad</SelectItem>
                  {SQUADS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Cargo</label>
              <Select value={formPosition} onValueChange={handlePositionChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cargo</SelectItem>
                  {Object.entries(positionsByCategory).map(([cat, levels]) => (
                    <div key={cat}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{cat}</div>
                      {levels.map(l => (
                        <SelectItem key={l.id} value={l.position}>
                          {l.position} — {formatCurrency(l.salary_clt)}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Salário CLT (R$)</label>
              <Input
                value={formSalary}
                onChange={(e) => handleSalaryChange(e.target.value)}
                placeholder="0.00"
                type="number"
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Ao editar o salário, o cargo será ajustado automaticamente com base na tabela salarial.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
