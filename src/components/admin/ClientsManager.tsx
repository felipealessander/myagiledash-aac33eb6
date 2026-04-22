import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useClientsData, Client } from "@/hooks/useClientsData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, AlertTriangle, Save } from "lucide-react";
import { safeError } from "@/lib/safeError";

const CLASSIFICATIONS = ["Sob Demanda", "Sustentação", "Inovação", "Implantação"];

const MONTHS_2026 = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);

export function ClientsManager() {
  const { toast } = useToast();
  const { clients, hours, unmappedClients, loading, refetch } = useClientsData(MONTHS_2026[new Date().getMonth()]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // New client dialog
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCls, setNewCls] = useState("Sob Demanda");
  const [newAliases, setNewAliases] = useState("");

  const openEdit = (clientId: string) => {
    setEditingId(clientId);
    const map: Record<string, string> = {};
    MONTHS_2026.forEach(m => {
      const h = hours.find(x => x.client_id === clientId && x.month === m);
      map[m] = String(h?.contracted_hours ?? 0);
    });
    setEditHours(map);
  };

  const saveHours = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const rows = MONTHS_2026.map(m => ({
        client_id: editingId,
        month: m,
        contracted_hours: Number(editHours[m] || 0),
      }));
      const { error } = await supabase
        .from("client_monthly_hours")
        .upsert(rows, { onConflict: "client_id,month" });
      if (error) throw error;
      toast({ title: "Horas atualizadas com sucesso" });
      setEditingId(null);
      await refetch();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: safeError(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: Client) => {
    const { error } = await supabase.from("clients").update({ active: !c.active }).eq("id", c.id);
    if (error) {
      toast({ title: "Erro", description: safeError(error), variant: "destructive" });
    } else {
      await refetch();
    }
  };

  const deleteClient = async (c: Client) => {
    if (!confirm(`Remover cliente "${c.name} (${c.classification})"? Isto remove também todas as horas contratadas vinculadas.`)) return;
    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    if (error) toast({ title: "Erro", description: safeError(error), variant: "destructive" });
    else { toast({ title: "Cliente removido" }); refetch(); }
  };

  const createClient = async () => {
    if (!newName.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    const aliases = newAliases.split(",").map(s => s.trim()).filter(Boolean);
    if (!aliases.includes(newName.trim())) aliases.unshift(newName.trim());
    const { error } = await supabase.from("clients").insert({
      name: newName.trim(),
      classification: newCls,
      active: true,
      aliases,
    });
    if (error) {
      toast({ title: "Erro ao criar", description: safeError(error), variant: "destructive" });
    } else {
      toast({ title: "Cliente criado" });
      setNewOpen(false);
      setNewName(""); setNewAliases(""); setNewCls("Sob Demanda");
      refetch();
    }
  };

  const addAlias = async (c: Client, alias: string) => {
    const updated = Array.from(new Set([...(c.aliases || []), alias]));
    const { error } = await supabase.from("clients").update({ aliases: updated }).eq("id", c.id);
    if (error) toast({ title: "Erro", description: safeError(error), variant: "destructive" });
    else { toast({ title: `Alias '${alias}' adicionado a ${c.name}` }); refetch(); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Clientes Sob Demanda</CardTitle>
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Nome</label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: PGE MA" />
                </div>
                <div>
                  <label className="text-xs font-medium">Classificação</label>
                  <Select value={newCls} onValueChange={setNewCls}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLASSIFICATIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">Aliases (separados por vírgula)</label>
                  <Input value={newAliases} onChange={e => setNewAliases(e.target.value)} placeholder="PGEMA, PGE-MA" />
                  <p className="text-xs text-muted-foreground mt-1">Os valores que aparecem no campo "client" das tarefas YouTrack.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
                <Button onClick={createClient}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin h-5 w-5" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Aliases</TableHead>
                  <TableHead>Total Horas/2026</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map(c => {
                  const total = hours.filter(h => h.client_id === c.id).reduce((s, h) => s + Number(h.contracted_hours), 0);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{c.classification}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{(c.aliases || []).join(", ")}</TableCell>
                      <TableCell className="font-mono text-sm">{total.toFixed(0)}h</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(c.id)}>Editar Horas</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteClient(c)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {unmappedClients.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              Clientes não mapeados ({unmappedClients.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Estas tags aparecem no campo "client" das tarefas mas não estão vinculadas a nenhum cliente cadastrado. Adicione como alias de um cliente existente.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Horas (mês atual)</TableHead>
                  <TableHead>Tarefas</TableHead>
                  <TableHead>Vincular a</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmappedClients.map(u => (
                  <TableRow key={u.alias}>
                    <TableCell className="font-mono text-xs">{u.alias}</TableCell>
                    <TableCell>{u.spentHours.toFixed(1)}h</TableCell>
                    <TableCell>{u.taskCount}</TableCell>
                    <TableCell>
                      <Select onValueChange={(cid) => {
                        const c = clients.find(x => x.id === cid);
                        if (c) addAlias(c, u.alias);
                      }}>
                        <SelectTrigger className="w-[260px]"><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                        <SelectContent>
                          {clients.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.classification})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit hours dialog */}
      <Dialog open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Horas contratadas — {clients.find(c => c.id === editingId)?.name} ({clients.find(c => c.id === editingId)?.classification})
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            {MONTHS_2026.map(m => (
              <div key={m}>
                <label className="text-xs font-medium">{m}</label>
                <Input
                  type="number"
                  value={editHours[m] || ""}
                  onChange={e => setEditHours(prev => ({ ...prev, [m]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
            <Button onClick={saveHours} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
