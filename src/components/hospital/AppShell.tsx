import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, LogOut, Search, Settings } from "lucide-react";

import hospitalLogo from "@/assets/hospital-logo.png.asset.json";


import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { supabase } from "@/integrations/supabase/client";
import { fetchPatients, fetchWards } from "@/lib/queries";
import { careTypeLabel } from "@/lib/domain";

export interface Crumb {
  label: string;
  to?: string;
  params?: Record<string, string>;
}

export function AppShell({
  crumbs = [],
  title,
  subtitle,
  actions,
  children,
}: {
  crumbs?: Crumb[];
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: fetchPatients });
  const { data: wards = [] } = useQuery({ queryKey: ["wards"], queryFn: fetchWards });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { modo: "login" as const }, replace: true });
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:justify-between md:px-6">
          <Link to="/painel" className="flex min-w-0 items-center gap-3">
            <img
              src={hospitalLogo.url}
              alt="Logotipo do Hospital Santa Lúcia — Hospital do Coração"
              className="h-10 w-auto shrink-0 object-contain"
              width={160}
              height={40}
            />
            <span className="min-w-0 border-l border-border pl-3">
              <span className="block truncate font-display text-sm font-bold sm:text-base">
                Triagem Nutricional
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Hospital Santa Lúcia
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setSearchOpen(true)}
              className="gap-2"
              aria-label="Abrir busca global"
            >
              <Search className="size-4" />
              <span className="hidden sm:inline">Buscar paciente ou ala</span>
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Administração">
              <Link to="/admin">
                <Settings className="size-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {crumbs.length > 0 && (
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;
                return (
                  <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
                    <BreadcrumbItem>
                      {isLast || !crumb.to ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.to as never} params={(crumb.params ?? {}) as never}>
                            {crumb.label}
                          </Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </span>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>

        {children}
      </main>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Buscar paciente, prontuário ou ala..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Pacientes">
            {patients.map((patient) => (
              <CommandItem
                key={patient.id}
                value={`${patient.full_name} ${patient.medical_record ?? ""}`}
                onSelect={() => {
                  setSearchOpen(false);
                  navigate({ to: "/paciente/$patientId", params: { patientId: patient.id } });
                }}
              >
                <Activity className="mr-2 size-4 text-muted-foreground" />
                <span className="truncate">{patient.full_name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {patient.medical_record ?? "sem prontuário"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Alas">
            {wards.map((ward) => (
              <CommandItem
                key={ward.id}
                value={`${ward.name} ${careTypeLabel(ward.care_type)}`}
                onSelect={() => {
                  setSearchOpen(false);
                  navigate({ to: "/ala/$wardId", params: { wardId: ward.id } });
                }}
              >
                <span className="truncate">{ward.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {careTypeLabel(ward.care_type)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
