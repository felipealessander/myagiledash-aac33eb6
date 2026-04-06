import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Save } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gestor: "Gestor",
  coordenador: "Coordenador",
  dev: "Dev",
};

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const { role, approved, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      setLoadingProfile(true);
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();
      if (data) {
        setFullName(data.full_name ?? "");
        setEmail(data.email ?? user.email ?? "");
      } else {
        setEmail(user.email ?? "");
      }
      setLoadingProfile(false);
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado" });
    }
    setSaving(false);
  };

  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pt-14">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <User className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">E-mail</Label>
              <Input value={email} disabled className="opacity-70" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Nome completo</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Papel</Label>
                <div>
                  {role ? (
                    <Badge variant="secondary">{ROLE_LABELS[role] ?? role}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sem papel definido</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <div>
                  {approved ? (
                    <Badge variant="secondary" className="bg-success/20 text-success">Aprovado</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-warning/20 text-warning">Pendente</Badge>
                  )}
                </div>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Salvar</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
