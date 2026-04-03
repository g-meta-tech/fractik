"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge, PriorityBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { CreateCapabilityForm } from "@/components/app/projects/create-capability-form";
import { FeaturesListInline } from "@/components/app/projects/features-list";
import {
  Layers,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface CapabilitiesTabProps {
  projectId: Id<"projects">;
  projectSlug: string;
}

export function CapabilitiesTab({ projectId, projectSlug }: CapabilitiesTabProps) {
  const capabilities = useQuery(api.capabilities.listByProject, { projectId });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (capabilities === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {capabilities.length} {capabilities.length === 1 ? "capability" : "capabilities"}
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowCreateForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar
        </Button>
      </div>

      {capabilities.length === 0 && !showCreateForm && (
        <EmptyState
          icon={Layers}
          title="Sin capabilities"
          description="Las capabilities son las áreas funcionales de tu producto."
          actionLabel="Agregar capability"
          onAction={() => setShowCreateForm(true)}
        />
      )}

      {capabilities.map((cap) => (
        <CapabilityCard
          key={cap._id}
          capability={cap}
          expanded={expandedIds.has(cap._id)}
          onToggle={() => toggleExpand(cap._id)}
          projectSlug={projectSlug}
        />
      ))}

      {showCreateForm && (
        <CreateCapabilityForm
          projectId={projectId}
          onDone={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}

function CapabilityCard({
  capability,
  expanded,
  onToggle,
  projectSlug,
}: {
  capability: {
    _id: Id<"capabilities">;
    name: string;
    description: string;
    priority: string;
    status: string;
  };
  expanded: boolean;
  onToggle: () => void;
  projectSlug: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(capability.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const updateCap = useMutation(api.capabilities.update);
  const removeCap = useMutation(api.capabilities.remove);
  const features = useQuery(
    api.features.listByCapability,
    expanded ? { capabilityId: capability._id } : "skip",
  );

  async function handleSaveName() {
    if (editName.trim() && editName.trim() !== capability.name) {
      try {
        await updateCap({ capabilityId: capability._id, name: editName.trim() });
        toast.success("Capability actualizada");
      } catch {
        toast.error("Error al actualizar");
      }
    }
    setEditing(false);
  }

  async function handleDelete() {
    try {
      await removeCap({ capabilityId: capability._id });
      toast.success("Capability eliminada");
      setDeleteOpen(false);
    } catch {
      toast.error("Error al eliminar");
    }
  }

  async function handlePriorityChange(priority: "critical" | "high" | "medium" | "low") {
    try {
      await updateCap({ capabilityId: capability._id, priority });
    } catch {
      toast.error("Error al actualizar prioridad");
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="shrink-0 rounded p-1 hover:bg-accent"
              type="button"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              {editing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") {
                      setEditName(capability.name);
                      setEditing(false);
                    }
                  }}
                  className="h-7 text-sm font-medium"
                  autoFocus
                />
              ) : (
                <span
                  className="text-sm font-medium cursor-pointer hover:underline"
                  onDoubleClick={() => {
                    setEditName(capability.name);
                    setEditing(true);
                  }}
                >
                  {capability.name}
                </span>
              )}
              {capability.description && !expanded && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {capability.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <PriorityBadge priority={capability.priority} />
              <StatusBadge status={capability.status} />
              {expanded && features !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {features.length}f
                </span>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="sm" className="h-7 w-7 p-0" />}
                >
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditName(capability.name); setEditing(true); }}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar nombre
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handlePriorityChange("critical")}>
                    Prioridad: Crítica
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePriorityChange("high")}>
                    Prioridad: Alta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePriorityChange("medium")}>
                    Prioridad: Media
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePriorityChange("low")}>
                    Prioridad: Baja
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {expanded && (
            <div className="mt-3 ml-7 border-l pl-4">
              <FeaturesListInline
                capabilityId={capability._id}
                projectSlug={projectSlug}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar capability</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminarán todas las features, specs y tests asociados a{" "}
            <strong>{capability.name}</strong>. Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
