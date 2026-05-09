import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldX, Users, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Card = Database["public"]["Tables"]["cards"]["Row"];
type Audit = Database["public"]["Tables"]["audit_logs"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — FraudShield AI" }] }),
  component: AdminPanel,
});

function AdminPanel() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [cards, setCards] = useState<Card[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Admin access required");
      nav({ to: "/dashboard" });
    }
  }, [isAdmin, loading, nav]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("cards").select("*").order("risk_score", { ascending: false }).then(({ data }) => { if (data) setCards(data); });
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50).then(({ data }) => { if (data) setAudits(data); });
    supabase.from("profiles").select("*").order("created_at").then(({ data }) => { if (data) setUsers(data); });
  }, [isAdmin]);

  const toggleCard = async (c: Card) => {
    const next = c.status === "blocked" ? "active" : "blocked";
    const { error } = await supabase.from("cards").update({ status: next }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_logs").insert({ action: `card_${next}`, target: c.id, meta: { last4: c.last4 } });
    setCards(cards.map((x) => x.id === c.id ? { ...x, status: next } : x));
    toast.success(`Card •${c.last4} ${next}`);
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-accent" /> Admin Panel
        </h1>
        <p className="text-sm text-muted-foreground">User management, card controls, and audit trail</p>
      </div>

      <Tabs defaultValue="cards">
        <TabsList className="glass">
          <TabsTrigger value="cards"><ShieldX className="h-4 w-4 mr-1" /> Cards</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" /> Users</TabsTrigger>
          <TabsTrigger value="audit"><ScrollText className="h-4 w-4 mr-1" /> Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="cards">
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-glass-border">
                <tr>
                  <th className="text-left px-4 py-3">Card</th>
                  <th className="text-left px-4 py-3">Holder</th>
                  <th className="text-right px-4 py-3">Risk</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id} className="border-b border-glass-border last:border-0">
                    <td className="px-4 py-3 font-mono">•••• {c.last4}</td>
                    <td className="px-4 py-3">{c.holder}</td>
                    <td className="px-4 py-3 text-right font-mono">{(Number(c.risk_score) * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] uppercase font-mono px-2 py-0.5 rounded border",
                        c.status === "blocked" ? "bg-cyber-danger/15 text-cyber-danger border-cyber-danger/40" : "bg-cyber-success/15 text-cyber-success border-cyber-success/40")}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => toggleCard(c)}>
                        {c.status === "blocked" ? "Unblock" : "Block"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-glass-border">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-glass-border last:border-0">
                    <td className="px-4 py-3">{u.display_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-glass-border">
                <tr>
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Target</th>
                  <th className="text-left px-4 py-3">Meta</th>
                </tr>
              </thead>
              <tbody>
                {audits.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No audit events yet.</td></tr>}
                {audits.map((a) => (
                  <tr key={a.id} className="border-b border-glass-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono">{a.action}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.target}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{JSON.stringify(a.meta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
