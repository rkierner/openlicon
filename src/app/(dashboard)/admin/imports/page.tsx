"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Upload, CheckCircle2, XCircle, Loader2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type ImportJob = {
  id: string;
  type: string;
  filename: string;
  status: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  createdAt: string;
  completedAt: string | null;
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  COMPLETED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  FAILED: <XCircle className="h-4 w-4 text-destructive" />,
  RUNNING: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
  PENDING: <Clock className="h-4 w-4 text-muted-foreground" />,
};

export default function ImportsPage() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState<"TIME_ENTRIES" | "USERS" | "PROJECTS">("TIME_ENTRIES");

  async function fetchJobs() {
    const res = await fetch("/api/admin/imports");
    if (res.ok) {
      const json = await res.json();
      setJobs(json.data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { fetchJobs(); }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const Papa = (await import("papaparse")).default;
      const text = await file.text();
      const { data } = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });

      const res = await fetch("/api/admin/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, filename: file.name, rows: data }),
      });

      if (res.ok) await fetchJobs();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Import Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Import historical data from Replicon or other sources
        </p>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Import</CardTitle>
          <CardDescription>Upload a CSV file to start an import job</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(["TIME_ENTRIES", "USERS", "PROJECTS"] as const).map((t) => (
              <Button
                key={t}
                variant={type === t ? "default" : "outline"}
                size="sm"
                onClick={() => setType(t)}
                className="capitalize"
              >
                {t.replace("_", " ").toLowerCase()}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <label className="cursor-pointer">
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              <Button asChild disabled={uploading}>
                <span>
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload CSV
                </span>
              </Button>
            </label>
            <p className="text-sm text-muted-foreground">
              Import {type.replace("_", " ").toLowerCase()} from a Replicon CSV export
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Job history */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Import History</h2>
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">No import jobs yet</div>
        ) : (
          jobs.map((job) => (
            <Card key={job.id}>
              <CardContent className="flex items-center justify-between py-4 px-6">
                <div className="flex items-center gap-3">
                  {STATUS_ICON[job.status]}
                  <div>
                    <p className="text-sm font-medium">{job.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.type.replace("_", " ")} · {format(new Date(job.createdAt), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p>
                    <span className="text-green-600 dark:text-green-400 font-medium">{job.successRows}</span>
                    {" / "}
                    {job.totalRows} rows
                    {job.errorRows > 0 && (
                      <span className="text-destructive ml-1">({job.errorRows} errors)</span>
                    )}
                  </p>
                  <Badge
                    variant={
                      job.status === "COMPLETED"
                        ? "success"
                        : job.status === "FAILED"
                        ? "destructive"
                        : "info"
                    }
                    className="text-xs"
                  >
                    {job.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
