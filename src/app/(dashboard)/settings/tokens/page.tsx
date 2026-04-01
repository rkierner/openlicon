"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, Trash2, RotateCcw, Key, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateTokenDialog } from "@/components/pats/create-token-dialog";

type PAT = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
};

export default function TokensPage() {
  const [pats, setPats] = useState<PAT[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function fetchPats() {
    setLoading(true);
    const res = await fetch("/api/user/pats");
    if (res.ok) {
      const json = await res.json();
      setPats(json.data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { fetchPats(); }, []);

  async function revoke(id: string) {
    if (!confirm("Revoke this token? Any scripts using it will stop working immediately.")) return;
    setRevoking(id);
    await fetch(`/api/user/pats/${id}`, { method: "DELETE" });
    await fetchPats();
    setRevoking(null);
  }

  function isExpired(pat: PAT): boolean {
    return !!pat.expiresAt && new Date(pat.expiresAt) < new Date();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Personal Access Tokens</h1>
          <p className="text-sm text-muted-foreground">
            Create tokens to access the TIRP API from scripts, agents, or integrations.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Token
        </Button>
      </div>

      {/* Developer hint */}
      <div className="flex items-start gap-3 bg-muted rounded-lg p-4 text-sm">
        <Key className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
        <div>
          <p className="font-medium">Using the API</p>
          <p className="text-muted-foreground mt-1">
            Pass your token in the Authorization header:{" "}
            <code className="text-xs bg-background px-1.5 py-0.5 rounded font-mono">
              Authorization: Bearer tirp_...
            </code>
          </p>
          <p className="text-muted-foreground mt-1">
            API base:{" "}
            <code className="text-xs bg-background px-1.5 py-0.5 rounded font-mono">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/
            </code>
          </p>
        </div>
      </div>

      {/* Token list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pats.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2 border rounded-lg">
          <Key className="h-8 w-8 opacity-30" />
          <p className="text-sm">No tokens yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pats.map((pat) => (
            <Card key={pat.id} className={isExpired(pat) ? "opacity-60" : ""}>
              <CardContent className="py-4 px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{pat.name}</span>
                      {isExpired(pat) && (
                        <Badge variant="destructive" className="text-xs">Expired</Badge>
                      )}
                    </div>

                    {/* Token preview */}
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      tirp_{pat.tokenPrefix}••••••••••••••••••••••••
                    </p>

                    {/* Scopes */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pat.scopes.map((s) => (
                        <span
                          key={s}
                          className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    {/* Meta */}
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Created {format(new Date(pat.createdAt), "MMM d, yyyy")}</span>
                      {pat.expiresAt && (
                        <span>
                          Expires {format(new Date(pat.expiresAt), "MMM d, yyyy")}
                        </span>
                      )}
                      {pat.lastUsedAt && (
                        <span>
                          Last used {format(new Date(pat.lastUsedAt), "MMM d, yyyy")}
                          {pat.lastUsedIp && ` from ${pat.lastUsedIp}`}
                        </span>
                      )}
                      {!pat.lastUsedAt && <span className="italic">Never used</span>}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    disabled={revoking === pat.id}
                    onClick={() => revoke(pat.id)}
                    title="Revoke token"
                  >
                    {revoking === pat.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateTokenDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={fetchPats}
      />
    </div>
  );
}
