"use client";

import { useState } from "react";
import { Copy, Check, AlertCircle, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SCOPE_GROUPS } from "@/lib/scopes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

type Step = "form" | "reveal";

export function CreateTokenDialog({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setStep("form");
    setName("");
    setSelectedScopes(new Set());
    setExpiresInDays("");
    setToken("");
    setCopied(false);
    setError("");
  }

  function handleClose(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  function toggleScope(scope: string) {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Name is required"); return; }
    if (selectedScopes.size === 0) { setError("Select at least one scope"); return; }

    setLoading(true);
    setError("");

    try {
      const expiresAt = expiresInDays
        ? new Date(Date.now() + parseInt(expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const res = await fetch("/api/user/pats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scopes: Array.from(selectedScopes),
          expiresAt,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to create token");
        return;
      }

      setToken(json.data.token);
      setStep("reveal");
    } finally {
      setLoading(false);
    }
  }

  async function copyToken() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDone() {
    handleClose(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Create API Token</DialogTitle>
              <DialogDescription>
                Generate a Personal Access Token for API access or automation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Token name</Label>
                <Input
                  placeholder="e.g. VS Code Extension, CI Bot"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="space-y-3 border rounded-md p-3">
                  {SCOPE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        {group.label}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.scopes.map((scope) => (
                          <button
                            key={scope}
                            type="button"
                            onClick={() => toggleScope(scope)}
                            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                              selectedScopes.has(scope)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:border-primary"
                            }`}
                          >
                            {scope}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {selectedScopes.size > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedScopes.size} scope{selectedScopes.size !== 1 ? "s" : ""} selected
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Expires in (days, optional)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 90 — leave blank for no expiry"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  min={1}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {error}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? "Creating…" : "Generate Token"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Token Created</DialogTitle>
              <DialogDescription>
                Copy your token now. <strong>You won&apos;t be able to see it again.</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
                <Key className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <code className="text-xs flex-1 break-all font-mono">{token}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="flex-shrink-0"
                  onClick={copyToken}
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-md p-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  Store this token in your password manager or secret vault. It will not be shown again.
                </p>
              </div>

              <div className="text-sm">
                <p className="font-medium mb-1">Usage</p>
                <code className="block text-xs bg-muted p-2 rounded font-mono">
                  Authorization: Bearer {token.substring(0, 20)}…
                </code>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleDone}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
