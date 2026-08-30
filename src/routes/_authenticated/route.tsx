import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// MODO DEMONSTRAÇÃO: acesso livre, sem exigir login.
// Para reativar a exigência de conta, basta definir DEMO_OPEN_ACCESS = false —
// toda a estrutura de autenticação (rota /auth, gate, perfis) permanece intacta.
const DEMO_OPEN_ACCESS = true;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession lê a sessão local (sem ida à rede), evitando latência em cada navegação.
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return { user: data.session.user };


    if (DEMO_OPEN_ACCESS) {
      // Sessão anônima temporária: mantém as políticas de segurança do banco
      // (acesso somente autenticado) sem pedir criação de conta ao usuário.
      const { data: anon, error: anonError } = await supabase.auth.signInAnonymously();
      if (!anonError && anon.user) return { user: anon.user };
    }

    throw redirect({ to: "/auth", search: { modo: "login" as const } });
  },
  component: () => <Outlet />,
});
