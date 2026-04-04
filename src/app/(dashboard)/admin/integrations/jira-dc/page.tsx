"use client";

import { useState, useEffect } from "react";
import { Plug, Plus, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Program = { id: string; name: string; code: string } | null;
// MappingTask includes the full project->program chain (returned by the mappings API)
type MappingProject = { id: string; name: string; code: string; program: Program };
type MappingTask = { id: string; name: string; code: string | null; project: MappingProject };
// AdminTask is the shape returned by GET /api/admin/tasks (no program)
type AdminTaskProject = { id: string; name: string; code: string };
type Task = { id: string; name: string; code: string | null; project: AdminTaskProject };

type Mapping = {
  id: string;
  jiraProjectKey: string;
  taskId: string;
  task: MappingTask;
};

type Connection = {
  id: string;
  baseUrl: string;
  isEnabled: boolean;
  mappings: Mapping[];
} | null;

type TestResult = { connected: boolean; displayName?: string; username?: string; error?: string } | null;

export default function JiraDcIntegrationPage() {
  const [connection, setConnection] = useState<Connection>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);

  // Connection form state
  const [baseUrl, setBaseUrl] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [testPat, setTestPat] = useState("");

  // Add mapping dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newTaskId, setNewTaskId] = useState("");
  const [addingMapping, setAddingMapping] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function fetchConnection() {
    fetch("/api/admin/integrations/jira-dc")
      .then((r) => r.json())
      .then((j) => {
        const conn = j.data as Connection;
        setConnection(conn);
        if (conn) {
          setBaseUrl(conn.baseUrl);
          setIsEnabled(conn.isEnabled);
        }
        setLoading(false);
      });
  }

  function fetchTasks() {
    fetch("/api/admin/tasks")
      .then((r) => r.json())
      .then((j) => setTasks(j.data ?? []));
  }

  useEffect(() => {
    fetchConnection();
    fetchTasks();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/integrations/jira-dc", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), isEnabled }),
      });
      if (res.ok) {
        fetchConnection();
        setTestResult(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!baseUrl.trim() || !testPat.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/integrations/jira-dc/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), pat: testPat }),
      });
      const j = await res.json();
      setTestResult(j.data);
    } finally {
      setTesting(false);
    }
  }

  async function handleAddMapping() {
    if (!newKey.trim() || !newTaskId) return;
    setAddingMapping(true);
    try {
      const res = await fetch("/api/admin/integrations/jira-dc/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jiraProjectKey: newKey.trim().toUpperCase(), taskId: newTaskId }),
      });
      if (res.ok) {
        setAddDialogOpen(false);
        setNewKey("");
        setNewTaskId("");
        fetchConnection();
      }
    } finally {
      setAddingMapping(false);
    }
  }

  async function handleDeleteMapping(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/integrations/jira-dc/mappings/${id}`, { method: "DELETE" });
      fetchConnection();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const mappings = connection?.mappings ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Plug className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-semibold">Jira Data Center</h1>
          <p className="text-sm text-muted-foreground">
            Configure your Jira Data Center connection and map Jira projects to tasks.
          </p>
        </div>
      </div>

      {/* Connection configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
          <CardDescription>
            Connect to your Jira Data Center instance. Use a PAT below to verify the connection
            before saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baseUrl">Jira Data Center URL</Label>
            <Input
              id="baseUrl"
              type="url"
              placeholder="https://jira.company.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Base URL of your Jira Data Center instance. No trailing slash.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="isEnabled"
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="isEnabled" className="font-normal cursor-pointer">
              Enable hourly sync
            </Label>
          </div>

          {/* Test connection section */}
          <div className="border rounded-md p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">Test Connection</p>
            <div className="space-y-2">
              <Label htmlFor="testPat" className="text-xs text-muted-foreground">
                Jira Personal Access Token (for testing only — not saved)
              </Label>
              <Input
                id="testPat"
                type="password"
                placeholder="Paste a PAT to verify connectivity"
                value={testPat}
                onChange={(e) => setTestPat(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing || !baseUrl.trim() || !testPat.trim()}
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Test Connection
            </Button>
            {testResult && (
              <div className="flex items-center gap-2 text-sm">
                {testResult.connected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span>
                      Connected as{" "}
                      <span className="font-medium">{testResult.displayName}</span>
                      {testResult.username ? ` (${testResult.username})` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="text-destructive">{testResult.error}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !baseUrl.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Project mappings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Project Mappings</CardTitle>
            <CardDescription>
              Map each Jira project key to an openlicon task. Worklogs on unmapped projects are
              skipped during sync.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            disabled={!connection}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Mapping
          </Button>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {connection
                ? "No mappings yet. Add a Jira project key to start importing worklogs."
                : "Save a connection URL above before adding mappings."}
            </p>
          ) : (
            <div className="divide-y">
              {mappings.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {m.jiraProjectKey}
                    </Badge>
                    <span className="text-sm">
                      {m.task.name}
                      <span className="text-muted-foreground">
                        {" "}/ {m.task.project.name}
                        {m.task.project.program
                          ? ` / ${m.task.project.program.name}`
                          : ""}
                      </span>
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteMapping(m.id)}
                    disabled={deletingId === m.id}
                  >
                    {deletingId === m.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add mapping dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project Mapping</DialogTitle>
            <DialogDescription>
              Map a Jira project key to an openlicon task. Worklogs on issues in this Jira project
              will be imported to the selected task.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="newKey">Jira Project Key</Label>
              <Input
                id="newKey"
                placeholder="e.g. PROJ"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                The project key from Jira (e.g. the prefix in PROJ-123).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newTask">Openlicon Task</Label>
              <select
                id="newTask"
                value={newTaskId}
                onChange={(e) => setNewTaskId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select a task...</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.project.name} / {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMapping}
              disabled={addingMapping || !newKey.trim() || !newTaskId}
            >
              {addingMapping ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Add Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
