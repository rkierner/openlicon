"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Project = {
  id: string;
  name: string;
  code: string;
  status: string;
  billable: boolean;
  color: string | null;
  _count: { timeEntries: number; initiatives: number };
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/projects?status=all")
      .then((r) => r.json())
      .then((j) => { setProjects(j.data ?? []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">{projects.length} projects</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <Card key={p.id} className={p.status === "ARCHIVED" ? "opacity-60" : ""}>
              <CardContent className="flex items-center justify-between py-4 px-6">
                <div className="flex items-center gap-3">
                  {p.color && (
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                      <span className="font-medium text-sm">{p.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p._count.initiatives} initiatives · {p._count.timeEntries} entries
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.billable && <Badge variant="outline" className="text-xs">Billable</Badge>}
                  {p.status === "ARCHIVED" && (
                    <Badge variant="secondary" className="text-xs">
                      <Archive className="h-3 w-3 mr-1" />
                      Archived
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
