import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/hospital/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { CARE_TYPES, careTypeLabel, type Bed, type CareType, type Ward } from "@/lib/domain";
import { fetchAdmissions, fetchBeds, fetchRooms, fetchWards } from "@/lib/queries";
import { createOfflineOperation, runOrQueue } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração da estrutura — Triagem Nutricional Santa Lúcia" },
      {
        name: "description",
        content:
          "Gerencie alas, salas e leitos do hospital. Registros em uso são desativados, nunca excluídos, preservando o histórico.",
      },
      { property: "og:title", content: "Administração da estrutura hospitalar" },
      {
        property: "og:description",
        content: "Cadastro de alas, salas e leitos com preservação do histórico.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const queryClient = useQueryClient();
  const { data: wards = [] } = useQuery({ queryKey: ["wards"], queryFn: fetchWards });
  const { data: rooms = [] } = useQuery({ queryKey: ["rooms"], queryFn: () => fetchRooms() });
  const { data: beds = [] } = useQuery({ queryKey: ["beds"], queryFn: () => fetchBeds() });
  const { data: admissions = [] } = useQuery({
    queryKey: ["admissions"],
    queryFn: () => fetchAdmissions(),
  });

  const usedBedIds = useMemo(() => new Set(admissions.map((a) => a.bed_id)), [admissions]);

  const [wardName, setWardName] = useState("");
  const [wardCareType, setWardCareType] = useState<CareType>("particular");
  const [roomName, setRoomName] = useState("");
  const [roomWard, setRoomWard] = useState("");
  const [bedLabel, setBedLabel] = useState("");
  const [bedWard, setBedWard] = useState("");
  const [bedRoom, setBedRoom] = useState("");
  const [editing, setEditing] = useState<{ kind: "ward" | "bed"; id: string } | null>(null);
  const [deleting, setDeleting] = useState<{ kind: "ward" | "bed"; id: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [editCareType, setEditCareType] = useState<CareType>("particular");
  const [editWardId, setEditWardId] = useState("");
  const [editRoomId, setEditRoomId] = useState("");

  const refresh = () => queryClient.invalidateQueries();

  const createWard = useMutation({
    mutationFn: async () => {
      const name = wardName.trim();
      if (name.length < 2) throw new Error("Informe o nome da ala.");
      const payload = { id: crypto.randomUUID(), name: name.slice(0, 80), care_type: wardCareType };
      return runOrQueue(
        createOfflineOperation({ table: "wards", action: "insert", payload }),
        async () => {
          const { error } = await supabase.from("wards").insert(payload);
          if (error) throw error;
        },
      );
    },
    onSuccess: () => {
      toast.success("Ala criada.");
      setWardName("");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar ala."),
  });

  const createRoom = useMutation({
    mutationFn: async () => {
      const name = roomName.trim();
      if (!roomWard) throw new Error("Selecione a ala da sala.");
      if (name.length < 1) throw new Error("Informe o nome da sala.");
      const payload = { id: crypto.randomUUID(), name: name.slice(0, 80), ward_id: roomWard };
      return runOrQueue(
        createOfflineOperation({ table: "rooms", action: "insert", payload }),
        async () => {
          const { error } = await supabase.from("rooms").insert(payload);
          if (error) throw error;
        },
      );
    },
    onSuccess: () => {
      toast.success("Sala criada.");
      setRoomName("");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar sala."),
  });

  const createBed = useMutation({
    mutationFn: async () => {
      const label = bedLabel.trim();
      if (!bedWard) throw new Error("Selecione a ala do leito.");
      if (label.length < 1) throw new Error("Informe a identificação do leito.");
      const payload = {
        id: crypto.randomUUID(),
        label: label.slice(0, 40),
        ward_id: bedWard,
        room_id: bedRoom || null,
      };
      return runOrQueue(
        createOfflineOperation({ table: "beds", action: "insert", payload }),
        async () => {
          const { error } = await supabase.from("beds").insert(payload);
          if (error) throw error;
        },
      );
    },
    onSuccess: () => {
      toast.success("Leito criado.");
      setBedLabel("");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar leito."),
  });

  const toggleActive = useMutation({
    mutationFn: async ({
      table,
      id,
      isActive,
    }: {
      table: "wards" | "rooms" | "beds";
      id: string;
      isActive: boolean;
    }) => {
      const payload = { is_active: !isActive };
      return runOrQueue(
        createOfflineOperation({ table, action: "update", payload, recordId: id }),
        async () => {
          const { error } = await supabase.from(table).update(payload).eq("id", id);
          if (error) throw error;
        },
      );
    },
    onSuccess: () => {
      toast.success("Situação atualizada.");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar."),
  });

  const openWardEditor = (ward: Ward) => {
    setEditName(ward.name);
    setEditCareType(ward.care_type);
    setEditing({ kind: "ward", id: ward.id });
  };

  const openBedEditor = (bed: Bed) => {
    setEditName(bed.label);
    setEditWardId(bed.ward_id);
    setEditRoomId(bed.room_id ?? "");
    setEditing({ kind: "bed", id: bed.id });
  };

  const editStructure = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const name = editName.trim();
      if (!name) throw new Error("Informe um nome válido.");
      if (editing.kind === "ward") {
        const payload = { name: name.slice(0, 80), care_type: editCareType };
        return runOrQueue(
          createOfflineOperation({
            table: "wards",
            action: "update",
            payload,
            recordId: editing.id,
          }),
          async () => {
            const { error } = await supabase.from("wards").update(payload).eq("id", editing.id);
            if (error) throw error;
          },
        );
      }
      if (!editWardId) throw new Error("Selecione a ala do leito.");
      const payload = {
        label: name.slice(0, 40),
        ward_id: editWardId,
        room_id: editRoomId || null,
      };
      return runOrQueue(
        createOfflineOperation({
          table: "beds",
          action: "update",
          payload,
          recordId: editing.id,
        }),
        async () => {
          const { error } = await supabase.from("beds").update(payload).eq("id", editing.id);
          if (error) throw error;
        },
      );
    },
    onSuccess: () => {
      toast.success("Registro atualizado.");
      setEditing(null);
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Erro ao editar registro."),
  });

  const deleteStructure = useMutation({
    mutationFn: async () => {
      if (!deleting) return { deactivated: false };
      if (deleting.kind === "bed") {
        if (usedBedIds.has(deleting.id)) {
          const payload = { is_active: false };
          const result = await runOrQueue(
            createOfflineOperation({
              table: "beds",
              action: "update",
              payload,
              recordId: deleting.id,
            }),
            async () => {
              const { error } = await supabase.from("beds").update(payload).eq("id", deleting.id);
              if (error) throw error;
            },
          );
          return { deactivated: true, queued: result.queued };
        }
        const result = await runOrQueue(
          createOfflineOperation({ table: "beds", action: "delete", recordId: deleting.id }),
          async () => {
            const { error } = await supabase.from("beds").delete().eq("id", deleting.id);
            if (error) throw error;
          },
        );
        return { deactivated: false, queued: result.queued };
      }

      const hasChildren =
        rooms.some((room) => room.ward_id === deleting.id) ||
        beds.some((bed) => bed.ward_id === deleting.id);
      if (hasChildren) {
        const payload = { is_active: false };
        const result = await runOrQueue(
          createOfflineOperation({
            table: "wards",
            action: "update",
            payload,
            recordId: deleting.id,
          }),
          async () => {
            const { error } = await supabase.from("wards").update(payload).eq("id", deleting.id);
            if (error) throw error;
          },
        );
        return { deactivated: true, queued: result.queued };
      }
      const result = await runOrQueue(
        createOfflineOperation({ table: "wards", action: "delete", recordId: deleting.id }),
        async () => {
          const { error } = await supabase.from("wards").delete().eq("id", deleting.id);
          if (error) throw error;
        },
      );
      return { deactivated: false, queued: result.queued };
    },
    onSuccess: (result) => {
      toast.success(
        result?.queued
          ? "Alteração salva no aparelho e aguardando sincronização."
          : result?.deactivated
            ? "Registro desativado para preservar o histórico."
            : "Registro excluído.",
      );
      setDeleting(null);
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Erro ao excluir registro."),
  });

  return (
    <AppShell
      title="Administração da estrutura"
      subtitle="Alas, salas e leitos. Registros já utilizados são desativados — nunca excluídos — para preservar o histórico de internações e triagens."
      crumbs={[{ label: "Painel", to: "/painel" }, { label: "Administração" }]}
    >
      <Tabs defaultValue="alas">
        <TabsList className="mb-6">
          <TabsTrigger value="alas">Alas</TabsTrigger>
          <TabsTrigger value="salas">Salas</TabsTrigger>
          <TabsTrigger value="leitos">Leitos</TabsTrigger>
        </TabsList>

        <TabsContent value="alas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova ala</CardTitle>
              <CardDescription>A ala pertence a um tipo de atendimento.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="ward-name">Nome da ala</Label>
                <Input
                  id="ward-name"
                  value={wardName}
                  onChange={(e) => setWardName(e.target.value)}
                  maxLength={80}
                  placeholder="Ex.: Ala 19"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de atendimento</Label>
                <Select
                  value={wardCareType}
                  onValueChange={(value) => setWardCareType(value as CareType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createWard.mutate()} disabled={createWard.isPending}>
                Criar ala
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {wards.map((ward) => (
              <Row
                key={ward.id}
                title={ward.name}
                subtitle={`${careTypeLabel(ward.care_type)} · ${
                  beds.filter((b) => b.ward_id === ward.id).length
                } leito(s)`}
                isActive={ward.is_active}
                onToggle={() =>
                  toggleActive.mutate({ table: "wards", id: ward.id, isActive: ward.is_active })
                }
                onEdit={() => openWardEditor(ward)}
                onDelete={() => setDeleting({ kind: "ward", id: ward.id })}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="salas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova sala (opcional)</CardTitle>
              <CardDescription>Salas agrupam leitos dentro de uma ala.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="room-name">Nome da sala</Label>
                <Input
                  id="room-name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  maxLength={80}
                  placeholder="Ex.: Sala 3"
                />
              </div>
              <div className="space-y-2">
                <Label>Ala</Label>
                <Select value={roomWard} onValueChange={setRoomWard}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {wards.map((ward) => (
                      <SelectItem key={ward.id} value={ward.id}>
                        {ward.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createRoom.mutate()} disabled={createRoom.isPending}>
                Criar sala
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {rooms.map((room) => (
              <Row
                key={room.id}
                title={room.name}
                subtitle={`${wards.find((w) => w.id === room.ward_id)?.name ?? "—"} · ${
                  beds.filter((b) => b.room_id === room.id).length
                } leito(s)`}
                isActive={room.is_active}
                onToggle={() =>
                  toggleActive.mutate({ table: "rooms", id: room.id, isActive: room.is_active })
                }
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="leitos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Novo leito</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px_200px_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="bed-label">Identificação</Label>
                <Input
                  id="bed-label"
                  value={bedLabel}
                  onChange={(e) => setBedLabel(e.target.value)}
                  maxLength={40}
                  placeholder="Ex.: 1804-A"
                />
              </div>
              <div className="space-y-2">
                <Label>Ala</Label>
                <Select
                  value={bedWard}
                  onValueChange={(value) => {
                    setBedWard(value);
                    setBedRoom("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {wards.map((ward) => (
                      <SelectItem key={ward.id} value={ward.id}>
                        {ward.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sala (opcional)</Label>
                <Select value={bedRoom} onValueChange={setBedRoom} disabled={!bedWard}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem sala" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms
                      .filter((room) => room.ward_id === bedWard)
                      .map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createBed.mutate()} disabled={createBed.isPending}>
                Criar leito
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {beds.map((bed) => (
              <Row
                key={bed.id}
                title={bed.label}
                subtitle={`${wards.find((w) => w.id === bed.ward_id)?.name ?? "—"}${
                  bed.room_id
                    ? ` · ${rooms.find((r) => r.id === bed.room_id)?.name ?? "sala removida"}`
                    : " · sem sala"
                }${usedBedIds.has(bed.id) ? " · possui histórico de internações" : ""}`}
                isActive={bed.is_active}
                onToggle={() =>
                  toggleActive.mutate({ table: "beds", id: bed.id, isActive: bed.is_active })
                }
                onEdit={() => openBedEditor(bed)}
                onDelete={() => setDeleting({ kind: "bed", id: bed.id })}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar {editing?.kind === "ward" ? "ala" : "leito"}</DialogTitle>
            <DialogDescription>
              A alteração será refletida em todas as telas que usam este registro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-structure-name">
                {editing?.kind === "ward" ? "Nome da ala" : "Identificação do leito"}
              </Label>
              <Input
                id="edit-structure-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                maxLength={editing?.kind === "ward" ? 80 : 40}
              />
            </div>
            {editing?.kind === "ward" && (
              <div className="space-y-2">
                <Label>Tipo de atendimento</Label>
                <Select
                  value={editCareType}
                  onValueChange={(value) => setEditCareType(value as CareType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editing?.kind === "bed" && (
              <>
                <div className="space-y-2">
                  <Label>Ala</Label>
                  <Select
                    value={editWardId}
                    onValueChange={(value) => {
                      setEditWardId(value);
                      setEditRoomId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {wards.map((ward) => (
                        <SelectItem key={ward.id} value={ward.id}>
                          {ward.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sala</Label>
                  <Select
                    value={editRoomId || "none"}
                    onValueChange={(value) => setEditRoomId(value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem sala</SelectItem>
                      {rooms
                        .filter((room) => room.ward_id === editWardId)
                        .map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={() => editStructure.mutate()} disabled={editStructure.isPending}>
              {editStructure.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Registros sem histórico serão excluídos. Quando houver internações ou registros
              dependentes, o item será desativado para preservar os dados clínicos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteStructure.mutate()}
              disabled={deleteStructure.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStructure.isPending ? "Processando..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Row({
  title,
  subtitle,
  isActive,
  onToggle,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  isActive: boolean;
  onToggle: () => void;
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0">
        <p className="truncate font-semibold">{title}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Ativo" : "Inativo"}</Badge>
        <Button variant="outline" size="sm" onClick={onToggle}>
          {isActive ? "Desativar" : "Reativar"}
        </Button>
        {onEdit && (
          <Button variant="outline" size="icon" onClick={onEdit} title="Editar">
            <Pencil className="size-4" />
            <span className="sr-only">Editar</span>
          </Button>
        )}
        {onDelete && (
          <Button variant="outline" size="icon" onClick={onDelete} title="Excluir">
            <Trash2 className="size-4" />
            <span className="sr-only">Excluir</span>
          </Button>
        )}
      </div>
    </div>
  );
}
