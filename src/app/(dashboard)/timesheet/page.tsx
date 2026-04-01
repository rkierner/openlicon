"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addDays, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Send, Loader2, GitCommit, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HourCell } from "@/components/timesheet/hour-cell";
import { cn } from "@/lib/utils";

type TimeEntry = {
  id: string;
  date: string;
  hours: number;
  status: string;
  source: string;
  notes: string | null;
  project: { id: string; name: string; code: string; color: string | null };
  category: { id: string; name: string; code: string };
  initiative: { id: string; name: string } | null;
};

type Timesheet = {
  id: string;
  weekStart: string;
  status: string;
  totalHours: number;
  entries: TimeEntry[];
};

type ProjectRow = {
  projectId: string;
  projectCode: string;
  projectName: string;
  projectColor: string | null;
  entries: Record<string, TimeEntry | null>; // date → entry
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "outline",
  SUBMITTED: "info",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default function TimesheetPage() {
  const [currentWeek, setCurrentWeek] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const weekDates = Array.from({ length: 5 }, (_, i) => addDays(currentWeek, i));
  const isCurrentWeek =
    format(currentWeek, "yyyy-MM-dd") ===
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const fetchTimesheet = useCallback(async () => {
    setLoading(true);
    try {
      const weekStart = format(currentWeek, "yyyy-MM-dd");
      const res = await fetch(
        isCurrentWeek
          ? "/api/timesheets/current"
          : `/api/timesheets?weekStart=${weekStart}&weekEnd=${weekStart}`
      );
      if (res.ok) {
        const json = await res.json();
        setTimesheet(isCurrentWeek ? json.data : json.data[0] ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [currentWeek, isCurrentWeek]);

  useEffect(() => {
    fetchTimesheet();
  }, [fetchTimesheet]);

  // Build project rows from entries
  const projectRows: ProjectRow[] = [];
  if (timesheet?.entries) {
    const byProject = new Map<string, ProjectRow>();
    for (const entry of timesheet.entries) {
      if (!byProject.has(entry.project.id)) {
        byProject.set(entry.project.id, {
          projectId: entry.project.id,
          projectCode: entry.project.code,
          projectName: entry.project.name,
          projectColor: entry.project.color,
          entries: {},
        });
      }
      const dateKey = entry.date.substring(0, 10);
      byProject.get(entry.project.id)!.entries[dateKey] = entry;
    }
    projectRows.push(...Array.from(byProject.values()));
  }

  // Daily totals
  const dailyTotals = weekDates.map((d) => {
    const dateKey = format(d, "yyyy-MM-dd");
    return timesheet?.entries
      .filter((e) => e.date.substring(0, 10) === dateKey)
      .reduce((s, e) => s + Number(e.hours), 0) ?? 0;
  });

  const totalHours = timesheet?.totalHours ?? 0;
  const weeklyTarget = 40;
  const utilizationPct = Math.round((totalHours / weeklyTarget) * 100);

  async function handleSubmit() {
    if (!timesheet?.id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/timesheets/${timesheet.id}/submit`, { method: "POST" });
      if (res.ok) await fetchTimesheet();
    } finally {
      setSubmitting(false);
    }
  }

  const isEditable = timesheet?.status === "DRAFT" || !timesheet;
  const canSubmit = isEditable && totalHours > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">My Timesheet</h1>
          <p className="text-sm text-muted-foreground">
            {format(currentWeek, "MMM d")} – {format(addDays(currentWeek, 4), "MMM d, yyyy")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {!isCurrentWeek && (
              <Button variant="ghost" size="sm" onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                Today
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {timesheet && (
            <Badge variant={STATUS_COLORS[timesheet.status] as "outline" | "info" | "success" | "destructive"}>
              {timesheet.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium w-56">Project</th>
                {weekDates.map((d, i) => (
                  <th key={i} className="text-center px-3 py-2.5 font-medium w-20">
                    <div>{DAYS[i]}</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      {format(d, "M/d")}
                    </div>
                  </th>
                ))}
                <th className="text-center px-3 py-2.5 font-medium w-16">Total</th>
              </tr>
            </thead>
            <tbody>
              {projectRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="space-y-2">
                      <p>No time entries this week.</p>
                      <p className="text-xs">Use the API or click a cell to add entries.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                projectRows.map((row) => {
                  const rowTotal = Object.values(row.entries).reduce(
                    (s, e) => s + (e ? Number(e.hours) : 0),
                    0
                  );
                  return (
                    <tr key={row.projectId} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {row.projectColor && (
                            <div
                              className="h-2 w-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: row.projectColor }}
                            />
                          )}
                          <div>
                            <span className="font-mono text-xs text-muted-foreground">
                              {row.projectCode}
                            </span>
                            <p className="text-sm truncate max-w-[160px]">{row.projectName}</p>
                          </div>
                          {/* Source icons */}
                          {Object.values(row.entries).some((e) => e?.source === "AGENT") && (
                            <Cpu className="h-3 w-3 text-muted-foreground" aria-label="Agent" />
                          )}
                        </div>
                      </td>
                      {weekDates.map((d) => {
                        const dateKey = format(d, "yyyy-MM-dd");
                        const entry = row.entries[dateKey];
                        return (
                          <td key={dateKey} className="px-2 py-1.5">
                            <HourCell
                              value={entry ? Number(entry.hours) : null}
                              disabled={!isEditable}
                              onChange={() => {}}
                            />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center font-medium">
                        {rowTotal > 0 ? rowTotal : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Daily totals footer */}
            <tfoot>
              <tr className="border-t bg-muted/50 font-medium">
                <td className="px-4 py-2.5 text-sm text-muted-foreground">Daily Total</td>
                {dailyTotals.map((total, i) => (
                  <td key={i} className="text-center px-3 py-2.5 text-sm">
                    {total > 0 ? (
                      <span className={cn(total > 8 && "text-amber-600 dark:text-amber-400")}>
                        {total}h
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
                <td className="text-center px-3 py-2.5 text-sm font-semibold">
                  {totalHours > 0 ? `${totalHours}h` : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Footer: utilization + submit */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-sm text-muted-foreground">
          {totalHours > 0 && (
            <span>
              <span
                className={cn(
                  "font-semibold",
                  utilizationPct >= 100
                    ? "text-green-600 dark:text-green-400"
                    : utilizationPct >= 75
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-destructive"
                )}
              >
                {totalHours}h logged
              </span>
              {" · "}
              {utilizationPct}% of {weeklyTarget}h target
            </span>
          )}
        </div>

        {isEditable && (
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting} size="sm">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Submit Week
          </Button>
        )}
      </div>
    </div>
  );
}
