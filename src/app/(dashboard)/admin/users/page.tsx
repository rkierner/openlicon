"use client";

import { useState, useEffect } from "react";
import { Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type User = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  role: string;
  isActive: boolean;
  manager: { id: string; name: string } | null;
  costCenter: { name: string; code: string } | null;
  _count: { reports: number };
};

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  MANAGER: "secondary",
  USER: "outline",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((j) => { setUsers(j.data ?? []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">{users.length} active users</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {users.map((u) => (
            <Card key={u.id} className={!u.isActive ? "opacity-50" : ""}>
              <CardContent className="flex items-center justify-between py-3 px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {u.name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.email}
                      {u.title && ` · ${u.title}`}
                      {u.manager && ` · Reports to ${u.manager.name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.costCenter && (
                    <span className="text-xs text-muted-foreground">{u.costCenter.code}</span>
                  )}
                  <Badge variant={ROLE_VARIANT[u.role] ?? "outline"} className="text-xs capitalize">
                    {u.role.toLowerCase()}
                  </Badge>
                  {u._count.reports > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {u._count.reports}
                    </span>
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
