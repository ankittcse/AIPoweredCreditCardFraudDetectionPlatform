import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Activity, Bell, BarChart3, ShieldCheck, Bot, LogOut, Shield, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: Activity },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/assistant", label: "AI Assistant", icon: Bot },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    nav({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex grid-bg">
      {/* Sidebar */}
      <aside className="w-64 hidden md:flex flex-col glass border-r border-glass-border sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-glass-border">
          <div className="relative">
            <Shield className="h-7 w-7 text-primary" />
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary pulse-ring" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-gradient-cyber">FraudShield</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Defense Grid</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = loc.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                  active
                    ? "bg-primary/10 text-primary border border-primary/30 glow-cyan"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-3 w-3" />}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all mt-4 border-t border-glass-border pt-4",
                loc.pathname.startsWith("/admin")
                  ? "bg-accent/10 text-accent border border-accent/30 glow-violet"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5",
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="flex-1">Admin Panel</span>
            </Link>
          )}
        </nav>

        <div className="p-3 border-t border-glass-border space-y-2">
          <div className="px-2 py-2 text-xs">
            <div className="text-muted-foreground">Signed in as</div>
            <div className="truncate font-medium">{user?.email}</div>
          </div>
          <Button onClick={handleSignOut} variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 relative scanline">
        <header className="sticky top-0 z-20 glass border-b border-glass-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-cyber-success pulse-ring" />
              <span className="text-muted-foreground">System</span>
              <span className="font-medium text-cyber-success">OPERATIONAL</span>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground border-l border-glass-border pl-3">
              <span>Model:</span><span className="text-foreground font-mono">XGBoost v1.2.0</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            {new Date().toLocaleString()}
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
