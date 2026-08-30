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
import type { Admission } from "@/lib/domain";

interface DietDialogProps {
  admission: Admission | null;
  patientName?: string | undefined;
  onOpenChange: (open: boolean) => void;
}

/** Edita a observação de dieta da internação (usada na etiqueta impressa). */
export function DietDialog({ admission, patientName, onOpenChange }: DietDialogProps) {
  const queryClient = useQueryClient();
  const [diet, setDiet] = useState("");

  useEffect(() => {
    setDiet(admission?.diet_note ?? "");
  }, [admission?.id, admission?.diet_note]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!admission) throw new Error("Internação inválida.");
      const { error } = await supabase
        .from("admissions")
        .update({ diet_note: diet.trim().slice(0, 200) || null })
        .eq("id", admission.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dieta atualizada.");
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
            {patientName ? `${patientName} · ` : ""}A observação aparece na etiqueta impressa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="diet-note">Dieta / solicitações</Label>
          <Textarea
            id="diet-note"
            value={diet}
            onChange={(e) => setDiet(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Ex.: sem leite, mamão, sem sopa"
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
