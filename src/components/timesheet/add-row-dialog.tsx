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
import { Label } from "@/components/ui/label";

type Project = { id: string; name: string; code: string; color: string | null };
type Initiative = { id: string; name: string };
type Category = { id: string; name: string; code: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (project: Project, category: Category, initiative: Initiative | null) => void;
  existingKeys: Set<string>;
};

export function AddRowDialog({ open, onClose, onAdd, existingKeys }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projectId, setProjectId] = useState("");
  const [initiativeId, setInitiativeId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/projects")
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []));
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((j) => setCategories(j.data ?? []));
  }, [open]);

  useEffect(() => {
    if (!projectId) {
      setInitiatives([]);
      setInitiativeId("");
      return;
    }
    fetch(`/api/admin/initiatives?projectId=${projectId}`)
      .then((r) => r.json())
      .then((j) => {
        setInitiatives(j.data ?? []);
        setInitiativeId("");
      });
  }, [projectId]);

  function handleAdd() {
    const project = projects.find((p) => p.id === projectId);
    const category = categories.find((c) => c.id === categoryId);
    if (!project || !category) return;
    const initiative = initiatives.find((i) => i.id === initiativeId) ?? null;
    onAdd(project, category, initiative);
    reset();
  }

  function reset() {
    setProjectId("");
    setInitiativeId("");
    setCategoryId("");
    onClose();
  }

  const rowKey = `${projectId}::${categoryId}::${initiativeId}`;
  const isDuplicate = !!projectId && !!categoryId && existingKeys.has(rowKey);
  const canAdd = !!projectId && !!categoryId && !isDuplicate;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && reset()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add row</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {initiatives.length > 0 && (
            <div className="space-y-1.5">
              <Label>
                Initiative{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={initiativeId}
                onChange={(e) => setInitiativeId(e.target.value)}
              >
                <option value="">None</option>
                {initiatives.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Category</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {isDuplicate && (
            <p className="text-xs text-destructive">This row already exists on your timesheet.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={reset}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!canAdd}>
            Add row
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
