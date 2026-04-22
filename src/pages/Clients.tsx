import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { ClientsManager } from "@/components/admin/ClientsManager";

export default function Clients() {
  const { user, loading: authLoading } = useAuth();
  const { canManageClients, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) navigate("/auth");
      else if (!canManageClients) navigate("/");
    }
  }, [authLoading, roleLoading, user, canManageClients, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canManageClients) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pt-14">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Briefcase className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Clientes Sob Demanda</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Cadastre clientes, defina horas contratadas por mês e vincule as tags do YouTrack.
          Apenas clientes <strong>ativos</strong> aparecem nos relatórios do dashboard.
        </p>
        <ClientsManager />
      </div>
    </div>
  );
}
