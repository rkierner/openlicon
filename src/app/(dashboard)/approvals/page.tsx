"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfWeek, subDays } from "date-fns";
import { Check, X, Undo2, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Timesheet = {
  id: string;
  weekStart: string;
  status: string;
  submittedAt: string | null;
  approvedAt: string | null;
  user: { id: string; name: string; email: string };
  _count: { entries: number };
};

type StatusFilter = "SUBMITTED" | "APPROVED" | "REJECTED" | "DRAFT" | "overdue";

const STATUS_TABS: { label: string; value: StatusFilter | "ALL" }[] = [
  { label: "Pending", value: "SUBMITTED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Overdue", value: "overdue" },
  { label: "All", value: "ALL" },
];

const BADGE_VARIANT: Record<string, "info" | "success" | "destructive" | "outline"> = {
  SUBMITTED: "info",
  APPROVED: "success",
  REJECTED: "destructive",
  DRAFT: "outline",
};

// Monday of the current week
const thisMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
// Last Monday (end boundary for overdue)
const lastMonday = format(subDays(thisMonday, 7), "yyyy-MM-dd");

export default function ApprovalsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  // Filters
  const [statusTab, setStatusTab] = useState<StatusFilter | "ALL">("SUBMITTED");
  const [userSearch, setUserSearch] = useState("");
  const [weekFrom, setWeekFrom] = useState("");
  const [weekTo, setWeekTo] = useState("");
  const [page, setPage] = useState(1);

  const fetchTimesheets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "25");
      params.set("page", String(page));

      if (statusTab === "overdue") {
        params.set("status", "DRAFT");
        // Cap weekEnd at last Monday so only past weeks show; user's weekTo further narrows it
        params.set("weekEnd", weekTo && weekTo < lastMonday ? weekTo : lastMonday);
      } else {
        if (statusTab !== "ALL") params.set("status", statusTab);
        if (weekTo) params.set("weekEnd", weekTo);
      }

      if (weekFrom) params.set("weekStart", weekFrom);

      const res = await fetch(`/api/timesheets?${params}`);
      if (res.ok) {
        const json = await res.json();
        setTimesheets(json.data ?? []);
        setTotal(json.meta?.total ?? 0);
        setTotalPages(json.meta?.totalPages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [statusTab, weekFrom, weekTo, page]);

  useEffect(() => {
    setPage(1);
  }, [statusTab, weekFrom, weekTo, userSearch]);

  useEffect(() => {
    fetchTimesheets();
  }, [fetchTimesheets]);

  async function approve(id: string) {
    setActing(id);
    await fetch(`/api/timesheets/${id}/approve`, { method: "POST" });
    await fetchTimesheets();
    setActing(null);
  }

  async function reject(id: string) {
    setActing(id);
    await fetch(`/api/timesheets/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ notes: "Rejected — please review" }),
      headers: { "Content-Type": "application/json" },
    });
    await fetchTimesheets();
    setActing(null);
  }

  async function returnToUser(id: string) {
    setActing(id);
    await fetch(`/api/timesheets/${id}/return`, { method: "POST" });
    await fetchTimesheets();
    setActing(null);
  }

  function initials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);
  }

  // Client-side user name filter applied on top of server results
  const visible = userSearch.trim()
    ? timesheets.filter(
        (ts) =>
          ts.user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
          ts.user.email.toLowerCase().includes(userSearch.toLowerCase())
      )
    : timesheets;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Review timesheets from your team
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusTab(tab.value)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              statusTab === tab.value
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & date filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Week from</label>
          <Input
            type="date"
            value={weekFrom}
            onChange={(e) => setWeekFrom(e.target.value)}
            className="h-9 w-36 text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground whitespace-nowrap">to</label>
          <Input
            type="date"
            value={weekTo}
            onChange={(e) => setWeekTo(e.target.value)}
            className="h-9 w-36 text-sm"
          />
        </div>

        {(weekFrom || weekTo || userSearch) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-9"
            onClick={() => { setWeekFrom(""); setWeekTo(""); setUserSearch(""); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
          <Check className="h-10 w-10 opacity-30" />
          <p className="text-sm">No timesheets match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {userSearch ? `${visible.length} of ${total}` : total} timesheet{total !== 1 ? "s" : ""}
          </p>

          {visible.map((ts) => (
            <Card key={ts.id}>
              <CardContent className="flex items-center justify-between py-4 px-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {initials(ts.user.name)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{ts.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Week of {format(new Date(ts.weekStart), "MMM d, yyyy")}
                      {ts.submittedAt && (
                        <> · Submitted {format(new Date(ts.submittedAt), "MMM d")}</>
                      )}
                      {ts.approvedAt && (
                        <> · Approved {format(new Date(ts.approvedAt), "MMM d")}</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{ts._count.entries} entries</p>
                    <Badge variant={BADGE_VARIANT[ts.status] ?? "outline"} className="text-xs">
                      {ts.status === "DRAFT" ? "Not submitted" : ts.status.charAt(0) + ts.status.slice(1).toLowerCase()}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    {ts.status === "SUBMITTED" && (
                      <>
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
                      </>
                    )}

                    {ts.status === "APPROVED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acting === ts.id}
                        onClick={() => returnToUser(ts.id)}
                      >
                        {acting === ts.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Undo2 className="h-3.5 w-3.5 mr-1" />
                        )}
                        Return
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="ghost"
                size="icon"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
