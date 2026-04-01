"use client";

import { useState, useEffect } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default function ReportsPage() {
  const [groupBy, setGroupBy] = useState<"project" | "category" | "week" | "user">("project");
  const [dateFrom] = useState(() => format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [dateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch_() {
      setLoading(true);
      const res = await fetch(
        `/api/reports/summary?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=${groupBy}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
      setLoading(false);
    }
    fetch_();
  }, [groupBy, dateFrom, dateTo]);

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
      <div className="flex gap-2 flex-wrap">
        {(["project", "category", "week", "user"] as const).map((g) => (
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
          <CardDescription>Last 3 months</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : topGroups.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <BarChart2 className="h-10 w-10 opacity-30" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topGroups} layout="vertical" margin={{ left: 120 }}>
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  width={120}
                />
                <Tooltip
                  formatter={(v) => [`${v}h`, "Hours"]}
                  contentStyle={{ fontSize: 12 }}
                />
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
      {data && !loading && (
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
