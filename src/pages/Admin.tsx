import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  UserPlus,
  KeyRound,
  ShieldCheck,
  ShieldX,
  Trash2,
  Shield,
  Users,
} from "lucide-react";
import { TeamMembersManager } from "@/components/admin/TeamMembersManager";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  approved: boolean;
  role: AppRole;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gestor: "Gestor",
  coordenador: "Coordenador",
  dev: "Dev",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/20 text-destructive",
  gestor: "bg-primary/20 text-primary",
  coordenador: "bg-info/20 text-info-foreground",
  dev: "bg-secondary text-secondary-foreground",
};

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) navigate("/auth");
      else if (!isAdmin) navigate("/");
    }
  }, [authLoading, roleLoading, user, isAdmin, navigate]);

  const callAdmin = useCallback(
    async (body: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    []
  );

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await callAdmin({ action: "list_users" });

      // Get profiles and roles
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("*");

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
      const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) ?? []);

      const mapped: UserProfile[] = (data.users || []).map((u: any) => {
        const profile = profileMap.get(u.id);
        return {
          id: u.id,
          email: u.email ?? "",
          full_name: profile?.full_name ?? "",
          approved: profile?.approved ?? false,
          role: (roleMap.get(u.id) as AppRole) ?? null,
          created_at: u.created_at,
        };
      });

      setUsers(mapped.sort((a, b) => a.email.localeCompare(b.email)));
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [callAdmin, toast]);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  const handleAction = async (
    actionName: string,
    body: Record<string, unknown>,
    successMsg: string
  ) => {
    const key = `${actionName}-${body.userId || body.email}`;
    setActionLoading(key);
    try {
      await callAdmin({ action: actionName, ...body });
      toast({ title: "Sucesso", description: successMsg });
      await fetchUsers();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    await handleAction("invite_user", { email: inviteEmail.trim() }, "Convite enviado com sucesso!");
    setInviteEmail("");
    setInviteOpen(false);
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pt-14">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Administração</h1>
          </div>

          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Usuário</DialogTitle>
                <DialogDescription>
                  Um link de cadastro será enviado para o e-mail informado.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="email@exemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                type="email"
              />
              <DialogFooter>
                <Button onClick={handleInvite} disabled={!inviteEmail.trim() || actionLoading !== null}>
                  {actionLoading?.startsWith("invite") ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Enviar Convite"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Usuários ({users.length})
            </CardTitle>
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
                      <TableHead>E-mail</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono text-xs">{u.email}</TableCell>
                        <TableCell>{u.full_name || "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={u.role ?? "none"}
                            onValueChange={(val) => {
                              if (val === "none") {
                                handleAction("remove_role", { userId: u.id }, "Papel removido");
                              } else {
                                handleAction("set_role", { userId: u.id, role: val }, "Papel atualizado");
                              }
                            }}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue>
                                {u.role ? (
                                  <Badge variant="secondary" className={`text-xs ${ROLE_COLORS[u.role] ?? ""}`}>
                                    {ROLE_LABELS[u.role] ?? u.role}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">Sem papel</span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem papel</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="gestor">Gestor</SelectItem>
                              <SelectItem value="coordenador">Coordenador</SelectItem>
                              <SelectItem value="dev">Dev</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {u.approved ? (
                            <Badge variant="secondary" className="bg-success/20 text-success text-xs">
                              Aprovado
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-warning/20 text-warning text-xs">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {!u.approved ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Aprovar"
                                disabled={actionLoading !== null}
                                onClick={() =>
                                  handleAction("update_approval", { userId: u.id, approved: true }, "Usuário aprovado")
                                }
                              >
                                <ShieldCheck className="h-4 w-4 text-success" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Revogar acesso"
                                disabled={actionLoading !== null || u.id === user?.id}
                                onClick={() =>
                                  handleAction("update_approval", { userId: u.id, approved: false }, "Acesso revogado")
                                }
                              >
                                <ShieldX className="h-4 w-4 text-warning" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Reset de senha"
                              disabled={actionLoading !== null}
                              onClick={() =>
                                handleAction("reset_password", { email: u.email }, "Link de reset enviado")
                              }
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              title="Remover usuário"
                              disabled={actionLoading !== null || u.id === user?.id}
                              onClick={() =>
                                handleAction("delete_user", { userId: u.id }, "Usuário removido")
                              }
                            >
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
        </Card>
        <TeamMembersManager />
      </div>
    </div>
  );
}
