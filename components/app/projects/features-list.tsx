"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { GitBranch, Plus } from "lucide-react";
import { toast } from "sonner";

interface FeaturesListInlineProps {
  capabilityId: Id<"capabilities">;
  projectSlug: string;
}

export function FeaturesListInline({ capabilityId, projectSlug }: FeaturesListInlineProps) {
  const features = useQuery(api.features.listByCapability, { capabilityId });
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  if (features === undefined) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {features.length === 0 && !showCreate && (
        <EmptyState
          icon={GitBranch}
          title="Sin features"
          description="Agrega features a esta capability."
          actionLabel="Agregar feature"
          onAction={() => setShowCreate(true)}
        />
      )}

      {features.map((feat) => (
        <button
          key={feat._id}
          onClick={() => router.push(`/projects/${projectSlug}/features/${feat._id}`)}
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
          type="button"
        >
          <span className="truncate">{feat.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">
              {feat.acceptanceCriteria.length} ACs
            </span>
            <StatusBadge status={feat.status} />
          </div>
        </button>
      ))}

      {showCreate ? (
        <CreateFeatureInline
          capabilityId={capabilityId}
          onDone={() => setShowCreate(false)}
        />
      ) : (
        features.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Agregar feature
          </Button>
        )
      )}
    </div>
  );
}

function CreateFeatureInline({
  capabilityId,
  onDone,
}: {
  capabilityId: Id<"capabilities">;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const createFeature = useMutation(api.features.create);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      await createFeature({ capabilityId, name: trimmed });
      toast.success("Feature creado");
      setName("");
      onDone();
    } catch {
      toast.error("Error al crear feature");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nuevo feature..."
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") onDone();
        }}
        disabled={loading}
        autoFocus
        className="h-7 text-sm"
      />
      <Button size="sm" variant="ghost" onClick={handleSubmit} disabled={!name.trim() || loading}>
        Crear
      </Button>
    </div>
  );
}
