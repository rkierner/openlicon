"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle2, Trash2, Download } from "lucide-react";
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

// ─── Jira Data Center ─────────────────────────────────────────────────────────

type JiraDcConfig = {
  id: string;
  jiraUsername: string;
  isEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  updatedAt: string;
} | null;

function JiraDcSection() {
  const [config, setConfig] = useState<JiraDcConfig>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [jiraUsername, setJiraUsername] = useState("");
  const [pat, setPat] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);

  function fetchConfig() {
    fetch("/api/user/integrations/jira-dc")
      .then((r) => r.json())
      .then((j) => {
        const c = j.data as JiraDcConfig;
        setConfig(c);
        if (c) {
          setJiraUsername(c.jiraUsername);
          setIsEnabled(c.isEnabled);
        }
        setLoading(false);
      });
  }

  useEffect(() => { fetchConfig(); }, []);

  async function handleSave() {
    if (!jiraUsername.trim() || !pat.trim()) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/user/integrations/jira-dc", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jiraUsername: jiraUsername.trim(), pat, isEnabled }),
      });
      if (res.ok) {
        setPat("");
        setSaveSuccess(true);
        fetchConfig();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await fetch("/api/user/integrations/jira-dc", { method: "DELETE" });
      setConfig(null);
      setJiraUsername("");
      setPat("");
      setIsEnabled(true);
      setRemoveDialogOpen(false);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            Jira Data Center
            {config && (
              <Badge variant={config.isEnabled ? "default" : "secondary"} className="text-xs">
                {config.isEnabled ? "Active" : "Paused"}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Automatically imports your Jira worklogs as time entries once per hour.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            {/* Sync status banner */}
            {config && (
              <div className="rounded-md border bg-muted/30 px-4 py-3 space-y-1 text-sm">
                {config.lastSyncError ? (
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{config.lastSyncError}</span>
                  </div>
                ) : config.lastSyncAt ? (
                  <div className="text-muted-foreground">
                    Last synced: {new Date(config.lastSyncAt).toLocaleString()}
                  </div>
                ) : (
                  <div className="text-muted-foreground">Sync has not run yet.</div>
                )}
              </div>
            )}

            {/* Credentials form */}
            <div className="space-y-2">
              <Label htmlFor="jiraDcUsername">Jira Username</Label>
              <Input
                id="jiraDcUsername"
                placeholder="your.username"
                value={jiraUsername}
                onChange={(e) => setJiraUsername(e.target.value)}
                autoComplete="username"
              />
              <p className="text-xs text-muted-foreground">
                Your Jira Data Center login username (used to match worklogs to your account).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jiraDcPat">
                Personal Access Token
                {config && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    — enter a new token to update
                  </span>
                )}
              </Label>
              <Input
                id="jiraDcPat"
                type="password"
                placeholder={config ? "Enter a new PAT to replace the stored one" : "Paste your Jira DC PAT"}
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Generate in Jira: Profile → Personal Access Tokens → Create token. Stored encrypted,
                never visible after saving.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="jiraDcEnabled"
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="jiraDcEnabled" className="font-normal cursor-pointer">
                Enable automatic hourly sync
              </Label>
            </div>

            {saveSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Credentials saved successfully.
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              {config ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setRemoveDialogOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Disconnect
                </Button>
              ) : (
                <div />
              )}
              <Button
                onClick={handleSave}
                disabled={saving || !jiraUsername.trim() || !pat.trim()}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                {config ? "Update" : "Connect"}
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Jira Data Center</DialogTitle>
            <DialogDescription>
              This will delete your stored Jira credentials. The hourly sync will skip your account
              until you reconnect. Time entries already imported will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Download className="h-5 w-5" />
        <div>
          <h1 className="text-2xl font-semibold">Imports</h1>
          <p className="text-sm text-muted-foreground">
            Configure external sources to automatically import your time entries.
          </p>
        </div>
      </div>

      <JiraDcSection />

      {/* Future import sources go here */}
    </div>
  );
}
