import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { severityBadgeClasses } from "@/components/fraud-ui";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Alert = Database["public"]["Tables"]["alerts"]["Row"];

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alerts — FraudShield AI" }] }),
  component: Alerts,
});

function Alerts() {
  const [rows, setRows] = useState<Alert[]>([]);

  useEffect(() => {
    const load = () => supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => { if (data) setRows(data); });
    load();
    const ch = supabase.channel("alerts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, (payload) => {
        load();
        if (payload.eventType === "INSERT") {
          const a = payload.new as Alert;
          if (a.severity === "critical") toast.error(`Critical: ${a.message}`);
          else toast.warning(`Alert: ${a.message}`);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const ack = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("alerts").update({ acknowledged_by: user?.id, acknowledged_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Acknowledged");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="h-6 w-6 text-cyber-warning" /> Smart Alerts
        </h1>
        <p className="text-sm text-muted-foreground">Real-time notifications from the fraud engine</p>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">No alerts yet. The grid is quiet.</div>}
        {rows.map((a) => (
          <div key={a.id} className={cn("glass rounded-xl p-4 flex items-start gap-4 border-l-2", a.acknowledged_at ? "opacity-60" : "")}
               style={{ borderLeftColor: a.severity === "critical" ? "var(--cyber-danger)" : a.severity === "high" ? "var(--cyber-pink)" : a.severity === "medium" ? "var(--cyber-warning)" : "var(--cyber-success)" }}>
            <span className={cn("text-[10px] uppercase font-mono px-2 py-0.5 rounded border h-fit", severityBadgeClasses(a.severity))}>{a.severity}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm">{a.message}</div>
              <div className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</div>
            </div>
            {!a.acknowledged_at && (
              <Button onClick={() => ack(a.id)} size="sm" variant="outline">
                <Check className="h-4 w-4 mr-1" /> Ack
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
