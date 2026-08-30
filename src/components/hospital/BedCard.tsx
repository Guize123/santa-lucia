import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BedDouble, CircleCheck, CircleSlash, UserPlus, Utensils } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DietDialog } from "@/components/hospital/DietDialog";
import {
  daysSince,
  formatDate,
  type Admission,
  type Bed,
  type Patient,
} from "@/lib/domain";

interface BedCardProps {
  bed: Bed;
  admission?: Admission | undefined;
  patient?: Patient | undefined;
  lastScreening?: string | undefined;
  onAdmit: (bed: Bed) => void;
}

export function BedCard({ bed, admission, patient, lastScreening, onAdmit }: BedCardProps) {
  const [dietOpen, setDietOpen] = useState(false);
  const inactive = !bed.is_active;

  return (
    <Card
      className={`gap-0 overflow-hidden border-border/70 py-0 ${inactive ? "bg-muted/40" : ""}`}
    >
      <div className={`h-1.5 ${inactive ? "bg-border" : "bg-primary"}`} aria-hidden="true" />
      <CardContent className="p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Leito
            </p>
            <p className="mt-1 truncate font-display text-xl font-bold">{bed.label}</p>
          </div>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
            {inactive ? (
              <CircleSlash className="size-5" aria-hidden="true" />
            ) : admission ? (
              <BedDouble className="size-5 text-primary" aria-hidden="true" />
            ) : (
              <CircleCheck className="size-5 text-success" aria-hidden="true" />
            )}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </dt>
            <dd className="mt-0.5 truncate text-sm font-bold">
              {inactive ? "Inativo" : admission ? "Ocupado" : "Livre"}
            </dd>
          </div>
          <div
            className={`rounded-xl px-3 py-2.5 ${admission && !lastScreening ? "bg-brand/10" : "bg-muted"}`}
          >
            <dt
              className={`text-[11px] font-semibold uppercase tracking-wide ${
                admission && !lastScreening ? "text-brand" : "text-muted-foreground"
              }`}
            >
              Triagem
            </dt>
            <dd
              className={`mt-0.5 truncate text-sm font-bold ${
                admission && !lastScreening ? "text-brand" : ""
              }`}
            >
              {inactive ? "—" : admission ? (lastScreening ? "Em dia" : "Pendente") : "—"}
            </dd>
          </div>
        </dl>

        {admission && patient ? (
          <div className="mt-4">
            <p className="truncate font-semibold">{patient.full_name}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
              <span>Prontuário {patient.medical_record ?? "—"}</span>
              <span>
                Desde {formatDate(admission.admitted_at)} ({daysSince(admission.admitted_at)}{" "}
                dia(s))
              </span>
            </p>
            <Badge variant={lastScreening ? "secondary" : "destructive"} className="mt-2">
              {lastScreening
                ? `Triado em ${formatDate(lastScreening)}`
                : "Sem triagem registrada"}
            </Badge>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button asChild size="sm">
                <Link to="/paciente/$patientId" params={{ patientId: patient.id }}>
                  Abrir ficha
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/triagem/nova/$admissionId" params={{ admissionId: admission.id }}>
                  Nova triagem
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="border-t border-border/60 pt-3 text-sm text-muted-foreground">
              {inactive
                ? "Reative o leito na administração para internar um paciente."
                : "Nenhum paciente internado neste leito."}
            </p>
            {!inactive && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full gap-2"
                onClick={() => onAdmit(bed)}
              >
                <UserPlus className="size-4" />
                Internar paciente
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
