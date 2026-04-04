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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Loader2 } from "lucide-react";

type Task = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  capitalizable: boolean;
  isActive: boolean;
  _count: { timeEntries: number };
};

type Project = {
  id: string;
  name: string;
  code: string;
  capital: boolean;
};

type Props = {
  open: boolean;
  project: Project | null;
  onClose: () => void;
};

type EditingTask = Partial<Task> & { isNew?: boolean };

export function TaskDialog({ open, project, onClose }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EditingTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && project) {
      setLoading(true);
      fetch(`/api/admin/tasks?projectId=${project.id}&includeInactive=true`)
        .then((r) => r.json())
        .then((j) => { setTasks(j.data ?? []); setLoading(false); });
    }
  }, [open, project]);

  function startNew() {
    setEditing({ isNew: true, name: "", code: "", description: "", capitalizable: false, isActive: true });
    setError(null);
  }

  function startEdit(task: Task) {
    setEditing({ ...task });
    setError(null);
  }

  async function handleSave() {
    if (!editing || !project) return;
    if (!editing.name?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: editing.name.trim(),
        code: editing.code?.trim() || undefined,
        description: editing.description?.trim() || undefined,
        capitalizable: editing.capitalizable ?? false,
        ...(editing.isNew ? { projectId: project.id } : { isActive: editing.isActive }),
      };

      const res = editing.isNew
        ? await fetch("/api/admin/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/admin/tasks/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.error?.message ?? "Something went wrong");
        return;
      }

      const updated = await fetch(`/api/admin/tasks?projectId=${project.id}&includeInactive=true`)
        .then((r) => r.json()).then((j) => j.data ?? []);
      setTasks(updated);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setEditing(null);
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Tasks — {project?.code} {project?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks yet.</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${!task.isActive ? "opacity-50" : ""}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {task.code && (
                      <span className="font-mono text-xs text-muted-foreground">{task.code}</span>
                    )}
                    <span className="font-medium truncate">{task.name}</span>
                    {project?.capital && task.capitalizable && (
                      <Badge variant="outline" className="text-xs">Cap</Badge>
                    )}
                    {!task.isActive && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{task._count.timeEntries} entries</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => startEdit(task)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Inline edit form */}
        {editing && (
          <div className="border rounded-md p-3 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">{editing.isNew ? "New task" : "Edit task"}</p>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Task name"
                  autoFocus
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input
                  value={editing.code ?? ""}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  placeholder="CODE"
                  maxLength={20}
                  className="h-8 w-20 font-mono text-sm uppercase"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              {project?.capital && (
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={editing.capitalizable ?? false}
                    onChange={(e) => setEditing({ ...editing, capitalizable: e.target.checked })}
                    className="rounded"
                  />
                  Capitalizable
                </label>
              )}
              {!editing.isNew && (
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={editing.isActive ?? true}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                    className="rounded"
                  />
                  Active
                </label>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setError(null); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!editing.name?.trim() || saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Save
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row items-center">
          {!editing && (
            <Button variant="outline" size="sm" className="mr-auto" onClick={startNew}>
              <Plus className="h-4 w-4 mr-1" />
              Add task
            </Button>
          )}
          <Button variant="ghost" onClick={handleClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
