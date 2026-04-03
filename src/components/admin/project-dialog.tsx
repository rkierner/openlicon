"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type Project = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  billable: boolean;
  color: string | null;
};

type Props = {
  open: boolean;
  project?: Project | null; // null/undefined = create mode
  onClose: () => void;
  onSaved: () => void;
};

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4",
];

export function ProjectDialog({ open, project, onClose, onSaved }: Props) {
  const isEdit = !!project;

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);
  const [color, setColor] = useState<string>("");
  const [status, setStatus] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (project) {
        setName(project.name);
        setCode(project.code);
        setDescription(project.description ?? "");
        setBillable(project.billable);
        setColor(project.color ?? "");
        setStatus(project.status as "ACTIVE" | "ARCHIVED");
      } else {
        setName("");
        setCode("");
        setDescription("");
        setBillable(true);
        setColor("");
        setStatus("ACTIVE");
      }
      setError(null);
    }
  }, [open, project]);

  async function handleSave() {
    if (!name.trim() || !code.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        ...(isEdit ? {} : { code: code.trim().toUpperCase() }),
        description: description.trim() || undefined,
        billable,
        color: color || undefined,
        ...(isEdit ? { status } : {}),
      };

      const res = isEdit
        ? await fetch(`/api/admin/projects/${project!.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/admin/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.error?.message ?? "Something went wrong");
        return;
      }

      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const canSave = name.trim().length > 0 && (isEdit || code.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proj-name">Name</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-code">Code</Label>
              <Input
                id="proj-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={20}
                className="w-24 font-mono uppercase"
                disabled={isEdit}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(color === c ? "" : c)}
                  className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                    outline: color === c ? `2px solid ${c}` : "none",
                  }}
                />
              ))}
              <Input
                type="color"
                value={color || "#6366f1"}
                onChange={(e) => setColor(e.target.value)}
                className="h-6 w-10 p-0 border rounded cursor-pointer"
                title="Custom color"
              />
              {color && (
                <button
                  type="button"
                  onClick={() => setColor("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="rounded"
              />
              Billable
            </label>

            {isEdit && (
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={status === "ARCHIVED"}
                  onChange={(e) => setStatus(e.target.checked ? "ARCHIVED" : "ACTIVE")}
                  className="rounded"
                />
                Archived
              </label>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
