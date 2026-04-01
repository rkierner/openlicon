"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Check, X, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Timesheet = {
  id: string;
  weekStart: string;
  status: string;
  totalHours?: number;
  submittedAt: string | null;
  user: { id: string; name: string; email: string };
  _count: { entries: number };
};

export default function ApprovalsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  async function fetchPending() {
    setLoading(true);
    try {
      const res = await fetch("/api/timesheets?status=SUBMITTED&pageSize=50");
      if (res.ok) {
        const json = await res.json();
        setTimesheets(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPending(); }, []);

  async function approve(id: string) {
    setActing(id);
    await fetch(`/api/timesheets/${id}/approve`, { method: "POST" });
    await fetchPending();
    setActing(null);
  }

  async function reject(id: string) {
    setActing(id);
    await fetch(`/api/timesheets/${id}/reject`, { method: "POST", body: JSON.stringify({ notes: "Rejected — please review" }), headers: { "Content-Type": "application/json" } });
    await fetchPending();
    setActing(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve submitted timesheets from your team
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : timesheets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
          <Check className="h-10 w-10 opacity-30" />
          <p className="text-sm">All caught up — no pending approvals</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{timesheets.length} pending</p>
          {timesheets.map((ts) => (
            <Card key={ts.id}>
              <CardContent className="flex items-center justify-between py-4 px-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {ts.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{ts.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Week of {format(new Date(ts.weekStart), "MMM d, yyyy")}
                      {ts.submittedAt && (
                        <> · Submitted {format(new Date(ts.submittedAt), "MMM d")}</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{ts._count.entries} entries</p>
                    <Badge variant="info" className="text-xs">Submitted</Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={acting === ts.id}
                      onClick={() => reject(ts.id)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={acting === ts.id}
                      onClick={() => approve(ts.id)}
                    >
                      {acting === ts.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      )}
                      Approve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
