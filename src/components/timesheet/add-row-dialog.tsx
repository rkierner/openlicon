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

type Program = { id: string; name: string; code: string };
type Project = { id: string; name: string; code: string; color: string | null; capital: boolean };
type Task = { id: string; name: string; code: string | null; capitalizable: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (task: Task, project: Project, program: Program) => void;
  existingTaskIds: Set<string>;
};

export function AddRowDialog({ open, onClose, onAdd, existingTaskIds }: Props) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [programId, setProgramId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/programs")
      .then((r) => r.json())
      .then((j) => setPrograms(j.data ?? []));
  }, [open]);

  useEffect(() => {
    if (!programId) { setProjects([]); setProjectId(""); return; }
    fetch(`/api/admin/projects?programId=${programId}&status=ACTIVE`)
      .then((r) => r.json())
      .then((j) => { setProjects(j.data ?? []); setProjectId(""); setTasks([]); setTaskId(""); });
  }, [programId]);

  useEffect(() => {
    if (!projectId) { setTasks([]); setTaskId(""); return; }
    fetch(`/api/admin/tasks?projectId=${projectId}`)
      .then((r) => r.json())
      .then((j) => { setTasks(j.data ?? []); setTaskId(""); });
  }, [projectId]);

  function handleAdd() {
    const task = tasks.find((t) => t.id === taskId);
    const project = projects.find((p) => p.id === projectId);
    const program = programs.find((p) => p.id === programId);
    if (!task || !project || !program) return;
    onAdd(task, project, program);
    reset();
  }

  function reset() {
    setProgramId("");
    setProjectId("");
    setTaskId("");
    onClose();
  }

  const isDuplicate = !!taskId && existingTaskIds.has(taskId);
  const canAdd = !!taskId && !isDuplicate;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && reset()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add row</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Program</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
            >
              <option value="">Select a program…</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>

          {programId && (
            <div className="space-y-1.5">
              <Label>Project</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
          )}

          {projectId && (
            <div className="space-y-1.5">
              <Label>Task</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">Select a task…</option>
                {tasks.filter((t) => !existingTaskIds.has(t.id)).map((t) => (
                  <option key={t.id} value={t.id}>{t.code ? `${t.code} — ` : ""}{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {isDuplicate && (
            <p className="text-xs text-destructive">This task already exists on your timesheet.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={reset}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!canAdd}>Add row</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
