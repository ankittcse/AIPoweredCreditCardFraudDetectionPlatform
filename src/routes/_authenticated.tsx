import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !session) nav({ to: "/login" });
  }, [loading, session, nav]);

  if (loading || !session) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Shield className="h-5 w-5 text-primary animate-pulse" />
          <span className="text-sm">Initializing defense grid…</span>
        </div>
      </div>
    );
  }

  return <AppShell><Outlet /></AppShell>;
}
