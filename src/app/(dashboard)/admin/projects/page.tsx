"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, Archive, Pencil, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectDialog } from "@/components/admin/project-dialog";
import { TaskDialog } from "@/components/admin/task-dialog";

type Project = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  capital: boolean;
  color: string | null;
  programId: string | null;
  program: { id: string; name: string; code: string } | null;
  _count: { tasks: number };
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [taskProject, setTaskProject] = useState<Project | null>(null);

  function fetchProjects() {
    fetch("/api/admin/projects?status=all")
      .then((r) => r.json())
      .then((j) => { setProjects(j.data ?? []); setLoading(false); });
  }

  useEffect(() => { fetchProjects(); }, []);

  function openCreate() {
    setEditingProject(null);
    setProjectDialogOpen(true);
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setProjectDialogOpen(true);
  }

  function openTasks(project: Project) {
    setTaskProject(project);
    setTaskDialogOpen(true);
  }

  // Group by program for display
  const grouped = new Map<string, { label: string; projects: Project[] }>();
  for (const p of projects) {
    const key = p.program?.id ?? "__none__";
    const label = p.program ? `${p.program.code} — ${p.program.name}` : "No program";
    if (!grouped.has(key)) grouped.set(key, { label, projects: [] });
    grouped.get(key)!.projects.push(p);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">{projects.length} projects</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        Array.from(grouped.entries()).map(([key, { label, projects: group }]) => (
          <div key={key} className="space-y-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
              {label}
            </h2>
            {group.map((p) => (
              <Card key={p.id} className={p.status === "ARCHIVED" ? "opacity-60" : ""}>
                <CardContent className="flex items-center justify-between py-4 px-6">
                  <div className="flex items-center gap-3">
                    {p.color && (
                      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                        <span className="font-medium text-sm">{p.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p._count.tasks} task{p._count.tasks !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.capital && <Badge variant="outline" className="text-xs">Capital</Badge>}
                    {p.status === "ARCHIVED" && (
                      <Badge variant="secondary" className="text-xs">
                        <Archive className="h-3 w-3 mr-1" />
                        Archived
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-foreground text-xs"
                      onClick={() => openTasks(p)}
                    >
                      <ListTodo className="h-3.5 w-3.5 mr-1" />
                      Tasks
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}

      <ProjectDialog
        open={projectDialogOpen}
        project={editingProject}
        onClose={() => setProjectDialogOpen(false)}
        onSaved={fetchProjects}
      />

      <TaskDialog
        open={taskDialogOpen}
        project={taskProject}
        onClose={() => setTaskDialogOpen(false)}
      />
    </div>
  );
}
