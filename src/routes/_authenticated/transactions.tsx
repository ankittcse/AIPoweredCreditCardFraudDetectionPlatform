import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RiskMeter, statusBadgeClasses } from "@/components/fraud-ui";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Tx = Database["public"]["Tables"]["transactions"]["Row"];

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions — FraudShield AI" }] }),
  component: TxList,
});

function TxList() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  useEffect(() => {
    const load = () => {
      supabase.from("transactions").select("*").order("ts", { ascending: false }).limit(200)
        .then(({ data }) => { if (data) setRows(data); });
    };
    load();
    const ch = supabase.channel("tx-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (q) {
      const hay = `${r.merchant} ${r.country} ${r.city ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [rows, q, status]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">Browse, filter, and review every scored transaction</p>
      </div>

      <div className="glass rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchant or location…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">{filtered.length} of {rows.length}</div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-glass-border">
            <tr>
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-left px-4 py-3">Merchant</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3 w-44">Risk</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-glass-border last:border-0 hover:bg-white/5">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(r.ts).toLocaleTimeString()}</td>
                <td className="px-4 py-3">
                  <Link to="/transactions/$txId" params={{ txId: r.id }} className="hover:text-primary">
                    {r.merchant}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.city}, {r.country}</td>
                <td className="px-4 py-3 text-right font-mono">${Number(r.amount).toFixed(2)}</td>
                <td className="px-4 py-3"><RiskMeter score={Number(r.fraud_score)} /></td>
                <td className="px-4 py-3">
                  <span className={cn("text-[10px] uppercase font-mono px-2 py-0.5 rounded border", statusBadgeClasses(r.status))}>{r.status}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No transactions match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
