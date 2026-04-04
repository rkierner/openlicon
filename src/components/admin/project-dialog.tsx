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
import { Loader2, Archive, ArchiveRestore, Plus } from "lucide-react";

type Program = { id: string; name: string; code: string };

type Project = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  capital: boolean;
  color: string | null;
  programId: string | null;
};

type Props = {
  open: boolean;
  project?: Project | null;
  defaultProgramId?: string;
  onClose: () => void;
  onSaved: () => void;
};

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4",
];

export function ProjectDialog({ open, project, defaultProgramId, onClose, onSaved }: Props) {
  const isEdit = !!project;

  const [programs, setPrograms] = useState<Program[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [capital, setCapital] = useState(false);
  const [color, setColor] = useState<string>("");
  const [programId, setProgramId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline new-program form
  const [showNewProgram, setShowNewProgram] = useState(false);
  const [newProgName, setNewProgName] = useState("");
  const [newProgCode, setNewProgCode] = useState("");
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [programError, setProgramError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/admin/programs")
        .then((r) => r.json())
        .then((j) => setPrograms(j.data ?? []));
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      if (project) {
        setName(project.name);
        setCode(project.code);
        setDescription(project.description ?? "");
        setCapital(project.capital);
        setColor(project.color ?? "");
        setProgramId(project.programId ?? "");
      } else {
        setName("");
        setCode("");
        setDescription("");
        setCapital(false);
        setColor("");
        setProgramId(defaultProgramId ?? "");
      }
      setError(null);
      setShowNewProgram(false);
      setNewProgName("");
      setNewProgCode("");
      setProgramError(null);
    }
  }, [open, project]);

  async function handleCreateProgram() {
    if (!newProgName.trim() || !newProgCode.trim()) return;
    setCreatingProgram(true);
    setProgramError(null);
    try {
      const res = await fetch("/api/admin/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProgName.trim(), code: newProgCode.trim().toUpperCase() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProgramError(json?.error?.message ?? "Could not create program");
        return;
      }
      const created = json.data;
      setPrograms((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setProgramId(created.id);
      setShowNewProgram(false);
      setNewProgName("");
      setNewProgCode("");
    } finally {
      setCreatingProgram(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || !code.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        ...(isEdit ? {} : { code: code.trim().toUpperCase() }),
        description: description.trim() || undefined,
        capital,
        color: color || undefined,
        programId: programId || null,
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

  async function handleArchiveToggle() {
    if (!project) return;
    setArchiving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: project.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.error?.message ?? "Something went wrong");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setArchiving(false);
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
          {/* Program */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="proj-program">
                Program <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              {!showNewProgram && !defaultProgramId && (
                <button
                  type="button"
                  onClick={() => setShowNewProgram(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                  New program
                </button>
              )}
            </div>

            {showNewProgram ? (
              <div className="rounded-md border border-input bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium">New program</p>
                <div className="flex gap-2">
                  <Input
                    value={newProgName}
                    onChange={(e) => setNewProgName(e.target.value)}
                    placeholder="Program name"
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Input
                    value={newProgCode}
                    onChange={(e) => setNewProgCode(e.target.value.toUpperCase())}
                    placeholder="CODE"
                    maxLength={20}
                    className="h-8 w-24 text-sm font-mono uppercase"
                  />
                </div>
                {programError && <p className="text-xs text-destructive">{programError}</p>}
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => { setShowNewProgram(false); setProgramError(null); }}
                    disabled={creatingProgram}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7"
                    onClick={handleCreateProgram}
                    disabled={!newProgName.trim() || !newProgCode.trim() || creatingProgram}
                  >
                    {creatingProgram && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                    Create
                  </Button>
                </div>
              </div>
            ) : (
              <select
                id="proj-program"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                disabled={!!defaultProgramId && !isEdit}
              >
                <option value="">No program</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Name + Code */}
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

          {/* Description */}
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

          {/* Color */}
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

          {/* Capital */}
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={capital}
              onChange={(e) => setCapital(e.target.checked)}
              className="rounded"
            />
            Capital project
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex-row items-center">
          {isEdit && (
            <Button
              variant="ghost"
              className="mr-auto text-muted-foreground hover:text-foreground"
              onClick={handleArchiveToggle}
              disabled={saving || archiving}
            >
              {archiving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : project?.status === "ARCHIVED" ? (
                <ArchiveRestore className="h-4 w-4 mr-2" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              {project?.status === "ARCHIVED" ? "Unarchive" : "Archive"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving || archiving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || saving || archiving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
