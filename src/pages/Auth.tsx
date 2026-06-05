import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      if (error) {
        toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "Cadastro realizado",
          description: "Verifique seu e-mail. Após confirmação, um administrador precisará aprovar seu acesso.",
        });
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-lg font-bold">Sprint Dashboard</h1>
          <p className="text-xs text-muted-foreground">{isLogin ? "Entre para gerenciar dados" : "Crie sua conta"}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-xs">Nome completo</Label>
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs">Senha</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? "Entrar" : "Cadastrar"}
          </Button>
        </form>

        {isLogin && (
          <p className="text-center text-xs text-muted-foreground">
            <button
              onClick={async () => {
                if (!email) {
                  toast({ title: "Informe o e-mail", description: "Digite seu e-mail acima primeiro.", variant: "destructive" });
                  return;
                }
                setLoading(true);
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) {
                  toast({ title: "Erro", description: error.message, variant: "destructive" });
                } else {
                  toast({ title: "E-mail enviado", description: "Verifique sua caixa de entrada para redefinir a senha." });
                }
                setLoading(false);
              }}
              className="text-primary hover:underline"
            >
              Esqueci minha senha
            </button>
          </p>
        )}

        <p className="text-center text-xs text-muted-foreground">
          {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
            {isLogin ? "Cadastre-se" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}
