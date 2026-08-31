import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDietLabel, type Admission } from "@/lib/domain";
import { createOfflineOperation, runOrQueue } from "@/lib/offline";

interface DietDialogProps {
  admission: Admission | null;
  patientName?: string | undefined;
  onOpenChange: (open: boolean) => void;
}

/** Edita a observação de dieta da internação (usada na etiqueta impressa). */
export function DietDialog({ admission, patientName, onOpenChange }: DietDialogProps) {
  const queryClient = useQueryClient();
  const [diet, setDiet] = useState("");
  const [observation, setObservation] = useState("");

  useEffect(() => {
    setDiet(admission?.diet_note ?? "");
    setObservation(admission?.notes ?? "");
  }, [admission?.id, admission?.diet_note, admission?.notes]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!admission) throw new Error("Internação inválida.");
      const payload = {
        diet_note: diet.trim().slice(0, 200) || null,
        notes: observation.trim().slice(0, 200) || null,
      };
      return runOrQueue(
        createOfflineOperation({
          table: "admissions",
          action: "update",
          payload,
          recordId: admission.id,
        }),
        async () => {
          const { error } = await supabase
            .from("admissions")
            .update(payload)
            .eq("id", admission.id);
          if (error) throw error;
        },
      );
    },
    onSuccess: ({ queued }) => {
      toast.success(
        queued ? "Dieta salva no aparelho e aguardando sincronização." : "Dieta atualizada.",
      );
      queryClient.invalidateQueries();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a dieta.");
    },
  });

  return (
    <Dialog open={!!admission} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dieta do paciente</DialogTitle>
          <DialogDescription>
            {patientName ? `${patientName} · ` : ""}
            {formatDietLabel(diet, observation) ||
              "Preencha a dieta e, se necessário, a observação."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="diet-note">Dieta</Label>
          <Textarea
            id="diet-note"
            value={diet}
            onChange={(e) => setDiet(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="Ex.: GERAL HAS"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="diet-observation">Observação da etiqueta</Label>
          <Textarea
            id="diet-observation"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="Ex.: MAMÃO"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar dieta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
