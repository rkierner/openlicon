"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, Pencil, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectDialog } from "@/components/admin/project-dialog";
import { TaskDialog } from "@/components/admin/task-dialog";

type Program = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  _count: { projects: number };
};

type ProjectSummary = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  capital: boolean;
  color: string | null;
  programId: string | null;
  _count: { tasks: number };
};

type EditingProgram = Partial<Program> & { isNew?: boolean };

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditingProgram | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Projects within the program being edited
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Sub-dialogs
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskProject, setTaskProject] = useState<ProjectSummary | null>(null);

  function fetchPrograms() {
    fetch("/api/admin/programs")
      .then((r) => r.json())
      .then((j) => { setPrograms(j.data ?? []); setLoading(false); });
  }

  const fetchProjects = useCallback((programId: string) => {
    setProjectsLoading(true);
    fetch(`/api/admin/programs/${programId}`)
      .then((r) => r.json())
      .then((j) => { setProjects(j.data?.projects ?? []); setProjectsLoading(false); });
  }, []);

  useEffect(() => { fetchPrograms(); }, []);

  function openCreate() {
    setEditing({ isNew: true, name: "", code: "", description: "", isActive: true });
    setProjects([]);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(program: Program) {
    setEditing({ ...program });
    setError(null);
    setDialogOpen(true);
    fetchProjects(program.id);
  }

  async function handleSave() {
    if (!editing || !editing.name?.trim() || (!editing.id && !editing.code?.trim())) return;
    setSaving(true);
    setError(null);
    try {
      const body = editing.isNew
        ? {
            name: editing.name.trim(),
            code: editing.code!.trim().toUpperCase(),
            description: editing.description?.trim() || undefined,
          }
        : {
            name: editing.name.trim(),
            description: editing.description?.trim() || undefined,
            isActive: editing.isActive,
          };

      const res = editing.isNew
        ? await fetch("/api/admin/programs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/admin/programs/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.error?.message ?? "Something went wrong");
        return;
      }
      fetchPrograms();
      if (editing.isNew) {
        setDialogOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleProjectSaved() {
    if (editing?.id) fetchProjects(editing.id);
    fetchPrograms();
  }

  const canSave = !!editing?.name?.trim() && (!!editing.id || !!editing.code?.trim());
  const isNew = !!editing?.isNew;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Programs</h1>
          <p className="text-sm text-muted-foreground">{programs.length} programs</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Program
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
          <p className="text-sm">No programs yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {programs.map((p) => (
            <Card key={p.id} className={!p.isActive ? "opacity-60" : ""}>
              <CardContent className="flex items-center justify-between py-4 px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                    <span className="font-medium text-sm">{p.name}</span>
                    {!p.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p._count.projects} project{p._count.projects !== 1 ? "s" : ""}
                    {p.description && <> · {p.description}</>}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => openEdit(p)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Program create/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className={isNew ? "max-w-sm" : "max-w-2xl"}>
          <DialogHeader>
            <DialogTitle>{isNew ? "New program" : `Edit — ${editing?.code} ${editing?.name}`}</DialogTitle>
          </DialogHeader>

          <div className={isNew ? "space-y-4" : "grid grid-cols-[1fr_1px_1.6fr] gap-6"}>
            {/* Program fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prog-name">Name</Label>
                  <Input
                    id="prog-name"
                    value={editing?.name ?? ""}
                    onChange={(e) => setEditing((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Program name"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prog-code">Code</Label>
                  <Input
                    id="prog-code"
                    value={editing?.code ?? ""}
                    onChange={(e) => setEditing((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="CODE"
                    maxLength={20}
                    className="w-24 font-mono uppercase"
                    disabled={!editing?.isNew}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prog-desc">
                  Description <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="prog-desc"
                  value={editing?.description ?? ""}
                  onChange={(e) => setEditing((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description…"
                />
              </div>

              {!editing?.isNew && (
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={editing?.isActive ?? true}
                    onChange={(e) => setEditing((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded"
                  />
                  Active
                </label>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            {/* Divider — only in edit mode */}
            {!isNew && <div className="bg-border" />}

            {/* Projects section — only in edit mode */}
            {!isNew && (
              <div className="space-y-2 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Projects</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setEditingProject(null); setProjectDialogOpen(true); }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add project
                  </Button>
                </div>

                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {projectsLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : projects.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No projects yet.</p>
                  ) : (
                    projects.map((proj) => (
                      <div
                        key={proj.id}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${proj.status === "ARCHIVED" ? "opacity-50" : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {proj.color && (
                              <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color }} />
                            )}
                            <span className="font-mono text-xs text-muted-foreground">{proj.code}</span>
                            <span className="font-medium truncate">{proj.name}</span>
                            {proj.capital && <Badge variant="outline" className="text-xs">Capital</Badge>}
                            {proj.status === "ARCHIVED" && <Badge variant="secondary" className="text-xs">Archived</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground pl-4">
                            {proj._count.tasks} task{proj._count.tasks !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Edit tasks"
                            onClick={() => { setTaskProject(proj); setTaskDialogOpen(true); }}
                          >
                            <List className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Edit project"
                            onClick={() => { setEditingProject(proj); setProjectDialogOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              {isNew ? "Cancel" : "Close"}
            </Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isNew ? "Create program" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project create/edit sub-dialog */}
      <ProjectDialog
        open={projectDialogOpen}
        project={editingProject}
        defaultProgramId={editing?.id}
        onClose={() => { setProjectDialogOpen(false); setEditingProject(null); }}
        onSaved={handleProjectSaved}
      />

      {/* Task sub-dialog */}
      <TaskDialog
        open={taskDialogOpen}
        project={taskProject}
        onClose={() => { setTaskDialogOpen(false); setTaskProject(null); }}
      />
    </div>
  );
}
