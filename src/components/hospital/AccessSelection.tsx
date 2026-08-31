import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, GraduationCap, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";

const accessProfiles = [
  { id: "estagiario", label: "Estagiário", icon: GraduationCap },
  { id: "nutricionista", label: "Nutricionista", icon: Stethoscope },
] as const;

export function AccessSelection() {
  const navigate = useNavigate();

  function handleAccess(profile: (typeof accessProfiles)[number]["id"]) {
    window.sessionStorage.setItem("nutri-access-profile", profile);
    navigate({ to: "/painel" });
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-[linear-gradient(145deg,#0b294d_0%,#174f83_52%,#0f667c_100%)] px-5 py-8 text-primary-foreground">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto aspect-[3/2] w-60 overflow-hidden rounded-md bg-white shadow-xl shadow-black/15 sm:w-64">
          <img
            src="/hospital-logo.png"
            alt="Logotipo do Hospital Santa Lúcia — Hospital do Coração"
            className="size-full object-cover object-[center_42%]"
            width={1255}
            height={1255}
          />
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold">Triagem Nutricional</h1>
        <p className="mt-1 text-sm text-primary-foreground/75">Hospital Santa Lúcia</p>

        <p className="mb-2 mt-9 text-left text-sm font-medium text-white/80">Acesso rápido</p>
        <div className="space-y-3" aria-label="Perfis de acesso">
          {accessProfiles.map((profile) => (
            <Button
              key={profile.id}
              type="button"
              onClick={() => handleAccess(profile.id)}
              className="group h-16 w-full justify-between rounded-md border border-white/20 bg-white/[0.09] px-3 text-base font-semibold text-white shadow-lg shadow-black/10 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/[0.16] focus-visible:ring-white active:translate-y-0"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-md bg-white text-[#174f83] shadow-sm transition-transform duration-200 group-hover:scale-105">
                  <profile.icon className="size-5" aria-hidden="true" />
                </span>
                {profile.label}
              </span>
              <ChevronRight
                className="mr-1 size-5 text-white/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white"
                aria-hidden="true"
              />
            </Button>
          ))}
        </div>
      </div>
    </main>
  );
}
