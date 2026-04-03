"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Pencil, Check } from "lucide-react";
import { toast } from "sonner";

interface AC {
  id: string;
  text: string;
  sortOrder: number;
}

interface AcceptanceCriteriaEditorProps {
  featureId: Id<"features">;
  criteria: AC[];
}

export function AcceptanceCriteriaEditor({
  featureId,
  criteria,
}: AcceptanceCriteriaEditorProps) {
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const updateFeature = useMutation(api.features.update);

  async function saveCriteria(updated: AC[]) {
    setSaving(true);
    try {
      await updateFeature({
        featureId,
        acceptanceCriteria: updated.map((ac, i) => ({
          ...ac,
          sortOrder: i,
        })),
      });
    } catch {
      toast.error("Error al guardar criteria");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const trimmed = newText.trim();
    if (!trimmed) return;

    const newAC: AC = {
      id: crypto.randomUUID(),
      text: trimmed,
      sortOrder: criteria.length,
    };
    await saveCriteria([...criteria, newAC]);
    setNewText("");
  }

  async function handleEdit(id: string) {
    const trimmed = editText.trim();
    if (!trimmed) return;

    const updated = criteria.map((ac) =>
      ac.id === id ? { ...ac, text: trimmed } : ac,
    );
    await saveCriteria(updated);
    setEditingId(null);
  }

  async function handleRemove(id: string) {
    const updated = criteria.filter((ac) => ac.id !== id);
    await saveCriteria(updated);
  }

  return (
    <div className="space-y-2">
      {criteria
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((ac, index) => (
          <div
            key={ac.id}
            className="flex items-center gap-2 rounded-md border px-3 py-2"
          >
            <span className="shrink-0 text-xs text-muted-foreground font-mono w-5">
              {index + 1}.
            </span>

            {editingId === ac.id ? (
              <>
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEdit(ac.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-7 flex-1 text-sm"
                  autoFocus
                  disabled={saving}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => handleEdit(ac.id)}
                  disabled={saving}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{ac.text}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={() => {
                    setEditingId(ac.id);
                    setEditText(ac.text);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(ac.id)}
                  disabled={saving}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}

      {/* Add new AC */}
      <div className="flex items-center gap-2">
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Agregar acceptance criteria..."
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          disabled={saving}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleAdd}
          disabled={!newText.trim() || saving}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
