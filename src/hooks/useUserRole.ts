import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "admin" | "gestor" | "coordenador" | "dev" | null;

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole>(null);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRole(null);
      setApproved(false);
      setLoading(false);
      return;
    }

    const fetchRoleAndApproval = async () => {
      setLoading(true);
      const [roleResult, profileResult] = await Promise.all([
        supabase.rpc("get_user_role", { _user_id: user.id }),
        supabase.from("profiles").select("approved").eq("id", user.id).single(),
      ]);

      setRole((roleResult.data as AppRole) ?? null);
      setApproved(profileResult.data?.approved ?? false);
      setLoading(false);
    };

    fetchRoleAndApproval();
  }, [user, authLoading]);

  const isAdmin = role === "admin";
  const canViewIndividual = role === "admin" || role === "gestor" || role === "coordenador";
  const canViewCapacity = role === "admin" || role === "gestor";
  const canViewAIInsights = role === "admin" || role === "gestor";
  const canManageClients = role === "admin" || role === "gestor";

  return { role, approved, loading: loading || authLoading, isAdmin, canViewIndividual, canViewCapacity, canViewAIInsights, canManageClients };
}
