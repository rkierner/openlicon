import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock, CheckSquare, BarChart2, Key, Users, Package } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserMenu } from "@/components/ui/user-menu";

const NAV_ITEMS = [
  { href: "/timesheet", label: "Timesheet", icon: Clock },
  { href: "/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/reports", label: "Reports", icon: BarChart2 },
  { href: "/admin/projects", label: "Projects", icon: Package },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/settings/tokens", label: "API Tokens", icon: Key },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as { id: string; name?: string | null; email?: string | null; role?: string };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top nav */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* Logo */}
          <Link href="/timesheet" className="flex items-center gap-2 mr-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Clock className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">TIRP</span>
          </Link>

          {/* Nav tabs */}
          <nav className="flex items-center gap-1 flex-1">
            {NAV_ITEMS.map((item) => {
              // Hide admin items for non-admins/managers
              if (
                (item.href.startsWith("/admin") || item.href === "/approvals") &&
                user.role === "USER"
              ) {
                return null;
              }
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
