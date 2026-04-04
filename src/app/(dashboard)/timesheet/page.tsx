"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addDays, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Send, Undo2, Loader2, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HourCell } from "@/components/timesheet/hour-cell";
import { AddRowDialog } from "@/components/timesheet/add-row-dialog";
import { cn } from "@/lib/utils";

type Program = { id: string; name: string; code: string };
type Project = { id: string; name: string; code: string; color: string | null; capital: boolean; program: Program };
type Task = { id: string; name: string; code: string | null; capitalizable: boolean; project: Project };

type TimeEntry = {
  id: string;
  date: string;
  hours: number;
  status: string;
  source: string;
  notes: string | null;
  task: Task;
};

type Timesheet = {
  id: string;
  weekStart: string;
  status: string;
  totalHours: number;
  entries: TimeEntry[];
};

type Row = {
  taskId: string;
  taskName: string;
  taskCode: string | null;
  capitalizable: boolean;
  projectId: string;
  projectCode: string;
  projectName: string;
  projectColor: string | null;
  capital: boolean;
  programName: string;
  entries: Record<string, TimeEntry | null>; // date → entry
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
  const [recalling, setRecalling] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingRows, setPendingRows] = useState<Row[]>([]);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  const isCurrentWeek =
    format(currentWeek, "yyyy-MM-dd") ===
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const fetchTimesheet = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }, [currentWeek, isCurrentWeek]);

  useEffect(() => {
    setTimesheet(null);
    setPendingRows([]);
    fetchTimesheet();
  }, [fetchTimesheet]);

  // Build rows from entries, grouped by task
  const rowsFromEntries = new Map<string, Row>();
  if (timesheet?.entries) {
    for (const entry of timesheet.entries) {
      const { task } = entry;
      if (!rowsFromEntries.has(task.id)) {
        rowsFromEntries.set(task.id, {
          taskId: task.id,
          taskName: task.name,
          taskCode: task.code,
          capitalizable: task.capitalizable,
          projectId: task.project.id,
          projectCode: task.project.code,
          projectName: task.project.name,
          projectColor: task.project.color,
          capital: task.project.capital,
          programName: task.project.program.name,
          entries: {},
        });
      }
      rowsFromEntries.get(task.id)!.entries[entry.date.substring(0, 10)] = entry;
    }
  }

  const allRows: Row[] = [
    ...Array.from(rowsFromEntries.values()),
    ...pendingRows.filter((r) => !rowsFromEntries.has(r.taskId)),
  ];
  const existingTaskIds = new Set(allRows.map((r) => r.taskId));

  const dailyTotals = weekDates.map((d) => {
    const dateKey = format(d, "yyyy-MM-dd");
    return (
      timesheet?.entries
        ?.filter((e) => e.date.substring(0, 10) === dateKey)
        .reduce((s, e) => s + Number(e.hours), 0) ?? 0
    );
  });

  const totalHours = timesheet?.totalHours ?? 0;
  const weeklyTarget = 40;
  const utilizationPct = Math.round((totalHours / weeklyTarget) * 100);

  async function handleHourChange(row: Row, dateKey: string, hours: number | null) {
    const entry = row.entries[dateKey];
    if (entry) {
      if (!hours) {
        await fetch(`/api/time-entries/${entry.id}`, { method: "DELETE" });
      } else {
        await fetch(`/api/time-entries/${entry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hours }),
        });
      }
    } else if (hours) {
      await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: row.taskId, date: dateKey, hours }),
      });
    }
    await fetchTimesheet(true);
  }

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

  async function handleRecall() {
    if (!timesheet?.id) return;
    setRecalling(true);
    try {
      const res = await fetch(`/api/timesheets/${timesheet.id}/recall`, { method: "POST" });
      if (res.ok) await fetchTimesheet();
    } finally {
      setRecalling(false);
    }
  }

  function handleAddRow(
    task: { id: string; name: string; code: string | null; capitalizable: boolean },
    project: { id: string; name: string; code: string; color: string | null; capital: boolean },
    program: { id: string; name: string; code: string }
  ) {
    if (existingTaskIds.has(task.id)) return;
    setPendingRows((prev) => [
      ...prev,
      {
        taskId: task.id,
        taskName: task.name,
        taskCode: task.code,
        capitalizable: task.capitalizable,
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        projectColor: project.color,
        capital: project.capital,
        programName: program.name,
        entries: {},
      },
    ]);
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
            {format(currentWeek, "MMM d")} – {format(addDays(currentWeek, 6), "MMM d, yyyy")}
          </p>
        </div>

        <div className="flex items-center gap-2">
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
                <th className="text-left px-4 py-2.5 font-medium w-64">Task</th>
                {weekDates.map((d, i) => (
                  <th key={i} className="text-center px-3 py-2.5 font-medium w-20">
                    <div>{DAYS[i]}</div>
                    <div className="text-xs text-muted-foreground font-normal">{format(d, "M/d")}</div>
                  </th>
                ))}
                <th className="text-center px-3 py-2.5 font-medium w-16">Total</th>
              </tr>
            </thead>
            <tbody>
              {allRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    <div className="space-y-3">
                      <p>No rows yet.</p>
                      {isEditable && (
                        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add your first row
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                allRows.map((row) => {
                  const rowTotal = Object.values(row.entries).reduce(
                    (s, e) => s + (e ? Number(e.hours) : 0),
                    0
                  );
                  return (
                    <tr key={row.taskId} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {row.projectColor && (
                            <div
                              className="h-2 w-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: row.projectColor }}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs text-muted-foreground">{row.projectCode}</span>
                              {Object.values(row.entries).some((e) => e?.source === "AGENT") && (
                                <Cpu className="h-3 w-3 text-muted-foreground" aria-label="Agent" />
                              )}
                            </div>
                            <p className="text-sm truncate max-w-[180px]">{row.taskName}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {row.projectName}
                              {row.capitalizable && (
                                <span className="ml-1 text-amber-600 dark:text-amber-400">· Cap</span>
                              )}
                            </p>
                          </div>
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
                              onChange={(hours) => handleHourChange(row, dateKey, hours)}
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
            <tfoot>
              <tr className="border-t bg-muted/50 font-medium">
                <td className="px-4 py-2.5">
                  {isEditable && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDialogOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add row
                    </Button>
                  )}
                </td>
                {dailyTotals.map((total, i) => (
                  <td key={i} className="text-center px-3 py-2.5 text-sm">
                    {total > 0 ? (
                      <span className={cn(total > 8 && "text-amber-600 dark:text-amber-400")}>{total}h</span>
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

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-sm text-muted-foreground">
          {totalHours > 0 && (
            <span>
              <span className={cn(
                "font-semibold",
                utilizationPct >= 100 ? "text-green-600 dark:text-green-400"
                  : utilizationPct >= 75 ? "text-amber-600 dark:text-amber-400"
                  : "text-destructive"
              )}>
                {totalHours}h logged
              </span>
              {" · "}
              {utilizationPct}% of {weeklyTarget}h target
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {timesheet?.status === "SUBMITTED" && (
            <Button variant="outline" size="sm" onClick={handleRecall} disabled={recalling}>
              {recalling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Undo2 className="h-4 w-4 mr-2" />}
              Unsubmit
            </Button>
          )}
          {isEditable && (
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting} size="sm">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Week
            </Button>
          )}
        </div>
      </div>

      <AddRowDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={handleAddRow}
        existingTaskIds={existingTaskIds}
      />
    </div>
  );
}
