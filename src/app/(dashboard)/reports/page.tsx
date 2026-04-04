"use client";

import { useState, useEffect } from "react";
import { format, subMonths } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";

type SummaryGroup = {
  key: string;
  label: string;
  hours: number;
  count: number;
  meta?: { color?: string };
};

type SummaryResponse = {
  groups: SummaryGroup[];
  totalHours: number;
  entryCount: number;
};

const STATUS_OPTIONS: MultiSelectOption[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const GROUP_OPTIONS = ["project", "task", "program", "week", "month", "user"] as const;

export default function ReportsPage() {
  const [groupBy, setGroupBy] = useState<(typeof GROUP_OPTIONS)[number]>("project");

  // Date filters
  const [dateFrom, setDateFrom] = useState(() => format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));

  // Multi-select filter values
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Filter options fetched from API
  const [projectOptions, setProjectOptions] = useState<MultiSelectOption[]>([]);
  const [programOptions, setProgramOptions] = useState<MultiSelectOption[]>([]);

  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch filter options once on mount
  useEffect(() => {
    fetch("/api/admin/projects")
      .then((r) => r.json())
      .then((j) =>
        setProjectOptions(
          (j.data ?? []).map((p: { id: string; name: string; code: string; color?: string }) => ({
            value: p.id,
            label: `${p.code} — ${p.name}`,
            color: p.color ?? undefined,
          }))
        )
      );
    fetch("/api/admin/programs")
      .then((r) => r.json())
      .then((j) =>
        setProgramOptions(
          (j.data ?? []).map((p: { id: string; name: string }) => ({
            value: p.id,
            label: p.name,
          }))
        )
      );
  }, []);

  // Fetch report data whenever filters change
  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ dateFrom, dateTo, groupBy });
      if (selectedProjects.length) params.set("projectId", selectedProjects.join(","));
      if (selectedPrograms.length) params.set("programId", selectedPrograms.join(","));
      if (selectedStatuses.length) params.set("status", selectedStatuses.join(","));

      const res = await fetch(`/api/reports/summary?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
      setLoading(false);
    }
    load();
  }, [groupBy, dateFrom, dateTo, selectedProjects, selectedPrograms, selectedStatuses]);

  const hasFilters =
    selectedProjects.length > 0 || selectedPrograms.length > 0 || selectedStatuses.length > 0;

  function clearFilters() {
    setSelectedProjects([]);
    setSelectedPrograms([]);
    setSelectedStatuses([]);
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Label", "Hours", "Entries"],
      ...data.groups.map((g) => [g.label, g.hours, g.count]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tirp-report-${dateFrom}-to-${dateTo}.csv`;
    a.click();
  }

  const topGroups = data?.groups.slice(0, 15) ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            {dateFrom} → {dateTo}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          max={dateTo}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        />
        <span className="text-muted-foreground text-sm">→</span>
        <input
          type="date"
          value={dateTo}
          min={dateFrom}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        />

        <div className="w-px h-5 bg-border mx-1" />

        <MultiSelect
          options={projectOptions}
          value={selectedProjects}
          onChange={setSelectedProjects}
          placeholder="Projects"
        />
        <MultiSelect
          options={programOptions}
          value={selectedPrograms}
          onChange={setSelectedPrograms}
          placeholder="Programs"
        />
        <MultiSelect
          options={STATUS_OPTIONS}
          value={selectedStatuses}
          onChange={setSelectedStatuses}
          placeholder="Status"
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Group by */}
      <div className="flex gap-2 flex-wrap">
        {GROUP_OPTIONS.map((g) => (
          <Button
            key={g}
            variant={groupBy === g ? "default" : "outline"}
            size="sm"
            onClick={() => setGroupBy(g)}
            className="capitalize"
          >
            By {g}
          </Button>
        ))}
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{data.totalHours}h</p>
              <p className="text-sm text-muted-foreground">Total logged</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{data.entryCount}</p>
              <p className="text-sm text-muted-foreground">Time entries</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{data.groups.length}</p>
              <p className="text-sm text-muted-foreground capitalize">{groupBy}s tracked</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base capitalize">Hours by {groupBy}</CardTitle>
          <CardDescription>
            {dateFrom} → {dateTo}
            {hasFilters && " · filtered"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : topGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
              <BarChart2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">No data for the selected filters</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, topGroups.length * 28)}>
              <BarChart data={topGroups} layout="vertical" margin={{ left: 120 }}>
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(v) => [`${v}h`, "Hours"]} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                  {topGroups.map((g, i) => (
                    <Cell
                      key={i}
                      fill={(g.meta as { color?: string })?.color ?? "hsl(var(--primary))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      {data && !loading && data.groups.length > 0 && (
        <Card>
          <CardContent className="pt-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-right py-3 px-4 font-medium">Hours</th>
                  <th className="text-right py-3 px-4 font-medium">Entries</th>
                  <th className="text-right py-3 px-4 font-medium">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g) => (
                  <tr key={g.key} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        {(g.meta as { color?: string })?.color && (
                          <div
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: (g.meta as { color?: string }).color }}
                          />
                        )}
                        {g.label}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium">{g.hours}h</td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">{g.count}</td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">
                      {data.totalHours > 0
                        ? Math.round((g.hours / data.totalHours) * 100)
                        : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
