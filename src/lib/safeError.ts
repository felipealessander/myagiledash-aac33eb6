/**
 * Maps raw errors to user-friendly messages,
 * preventing internal details from leaking to the UI.
 */
export function getSafeErrorMessage(error: unknown): string {
  if (!error) return "Ocorreu um erro inesperado.";

  const msg =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : (error as any)?.message ?? "";

  const code = (error as any)?.code;

  // Known Postgres / Supabase codes
  if (code === "23505") return "Este registro já existe.";
  if (code === "23503") return "Referência inválida.";
  if (code === "42501" || msg.includes("RLS")) return "Permissão negada.";
  if (code === "PGRST301") return "Sessão expirada. Faça login novamente.";

  // Network errors
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError"))
    return "Erro de conexão. Verifique sua internet.";

  // Generic fallback — no internal details
  return "Ocorreu um erro. Tente novamente ou contate o suporte.";
}
