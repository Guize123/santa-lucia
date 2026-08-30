import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { RACE_LABELS, type Bed, type CareType, type Race } from "@/lib/domain";
import { fetchAdmissions, fetchPatients } from "@/lib/queries";

const newPatientSchema = z.object({
  full_name: z.string().trim().min(3, "Informe o nome completo").max(120),
  medical_record: z.string().trim().max(40).optional(),
  mother_name: z.string().trim().max(120).optional(),
  age: z
    .string()
    .trim()
    .refine((v) => v === "" || (Number(v) >= 0 && Number(v) <= 120), "Idade inválida")
    .optional(),
  sex: z.enum(["F", "M"]),
  race: z.custom<Race>(),
});

/** Converte a idade informada em uma data de nascimento aproximada (mesmo dia/mês de hoje). */
function birthDateFromAge(age: string): string | null {
  const years = Number(age);
  if (!age || Number.isNaN(years)) return null;
  const now = new Date();
  const d = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
  return d.toISOString().slice(0, 10);
}

export function NewAdmissionDialog({
  bed,
  careType,
  onOpenChange,
}: {
  bed: Bed | null;
  careType: CareType;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"existente" | "novo">("existente");
  const [patientId, setPatientId] = useState("");
  const [fullName, setFullName] = useState("");
  const [record, setRecord] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"F" | "M">("F");
  const [race, setRace] = useState<Race>("nao_informado");
  const [diagnosis, setDiagnosis] = useState("");

  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: fetchPatients });
  const { data: activeAdmissions = [] } = useQuery({
    queryKey: ["admissions", "ativa"],
    queryFn: () => fetchAdmissions({ status: "ativa" }),
  });
  const admittedIds = new Set(activeAdmissions.map((a) => a.patient_id));
  const availablePatients = patients.filter((p) => !admittedIds.has(p.id));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!bed) throw new Error("Leito inválido.");
      let finalPatientId = patientId;

      if (mode === "novo") {
        const parsed = newPatientSchema.parse({
          full_name: fullName,
          medical_record: record,
          age,
          sex,
          race,
        });
        const { data, error } = await supabase
          .from("patients")
          .insert({
            full_name: parsed.full_name,
            medical_record: parsed.medical_record || null,
            birth_date: birthDateFromAge(parsed.age ?? ""),
            sex: parsed.sex,
            race: parsed.race,
          })
          .select("id")
          .single();
        if (error) throw error;
        finalPatientId = (data as { id: string }).id;
      }

      if (!finalPatientId) throw new Error("Selecione um paciente.");

      const { data: admission, error } = await supabase
        .from("admissions")
        .insert({
          patient_id: finalPatientId,
          bed_id: bed.id,
          care_type: careType,
          main_diagnosis: diagnosis.trim().slice(0, 300) || null,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505" || error.message.includes("admissions_one_active_per_bed")) {
          throw new Error("Este leito já possui uma internação ativa.");
        }
        if (error.message.includes("admissions_one_active_per_patient")) {
          throw new Error("Este paciente já possui uma internação ativa em outro leito.");
        }
        throw error;
      }
      return (admission as { id: string }).id;
    },
    onSuccess: (admissionId) => {
      toast.success("Internação registrada. Preencha a triagem do paciente.");
      queryClient.invalidateQueries();
      onOpenChange(false);
      setPatientId("");
      setFullName("");
      setRecord("");
      setAge("");
      setDiagnosis("");
      void navigate({
        to: "/triagem/nova/$admissionId",
        params: { admissionId },
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Dados inválidos.")
          : error instanceof Error
            ? error.message
            : "Não foi possível internar o paciente.",
      );
    },
  });

  return (
    <Dialog open={!!bed} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Internar paciente</DialogTitle>
          <DialogDescription>
            Leito {bed?.label}. Um leito nunca pode ter duas internações ativas ao mesmo tempo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mode === "existente" ? "default" : "outline"}
              onClick={() => setMode("existente")}
            >
              Paciente existente
            </Button>
            <Button variant={mode === "novo" ? "default" : "outline"} onClick={() => setMode("novo")}>
              Novo paciente
            </Button>
          </div>

          {mode === "existente" ? (
            <div className="space-y-2">
              <Label>Paciente sem internação ativa</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {availablePatients.length === 0 && (
                    <SelectItem value="__none" disabled>
                      Nenhum paciente disponível
                    </SelectItem>
                  )}
                  {availablePatients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.full_name} · {patient.medical_record ?? "sem prontuário"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="np-name">Nome completo</Label>
                <Input
                  id="np-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="np-record">Prontuário</Label>
                  <Input
                    id="np-record"
                    value={record}
                    onChange={(e) => setRecord(e.target.value)}
                    maxLength={40}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="np-age">Idade (anos)</Label>
                  <Input
                    id="np-age"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={120}
                    placeholder="Ex.: 72"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sexo</Label>
                  <Select value={sex} onValueChange={(value) => setSex(value as "F" | "M")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F">Feminino</SelectItem>
                      <SelectItem value="M">Masculino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Raça/cor autodeclarada</Label>
                  <Select value={race} onValueChange={(value) => setRace(value as Race)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RACE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="np-diagnosis">Diagnóstico principal (opcional)</Label>
            <Textarea
              id="np-diagnosis"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              maxLength={300}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Confirmar internação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
