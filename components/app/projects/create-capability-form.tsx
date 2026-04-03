"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CreateCapabilityFormProps {
  projectId: Id<"projects">;
  onDone: () => void;
}

export function CreateCapabilityForm({ projectId, onDone }: CreateCapabilityFormProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const createCap = useMutation(api.capabilities.create);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      await createCap({ projectId, name: trimmed });
      toast.success("Capability creada");
      setName("");
      onDone();
    } catch {
      toast.error("Error al crear capability");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border p-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nueva capability..."
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") onDone();
        }}
        disabled={loading}
        autoFocus
        className="h-8"
      />
      <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || loading}>
        {loading ? "..." : "Crear"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Cancelar
      </Button>
    </div>
  );
}
