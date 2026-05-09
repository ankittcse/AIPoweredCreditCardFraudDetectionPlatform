import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type Run = Database["public"]["Tables"]["model_runs"]["Row"];
type Tx = Database["public"]["Tables"]["transactions"]["Row"];

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — FraudShield AI" }] }),
  component: Analytics,
});

function Analytics() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [txns, setTxns] = useState<Tx[]>([]);

  useEffect(() => {
    supabase.from("model_runs").select("*").order("created_at", { ascending: false }).then(({ data }) => { if (data) setRuns(data); });
    supabase.from("transactions").select("*").order("ts", { ascending: false }).limit(500).then(({ data }) => { if (data) setTxns(data); });
  }, []);

  const compareData = useMemo(() => runs.map((r) => {
    const m = (r.metrics ?? {}) as Record<string, number>;
    return { name: r.name, precision: (m.precision ?? 0) * 100, recall: (m.recall ?? 0) * 100, f1: (m.f1 ?? 0) * 100 };
  }), [runs]);

  const radarData = useMemo(() => {
    const active = runs.find((r) => r.is_active);
    if (!active) return [];
    const m = (active.metrics ?? {}) as Record<string, number>;
    return [
      { metric: "Precision", value: (m.precision ?? 0) * 100 },
      { metric: "Recall", value: (m.recall ?? 0) * 100 },
      { metric: "F1", value: (m.f1 ?? 0) * 100 },
      { metric: "AUC", value: (m.auc ?? 0) * 100 },
      { metric: "TPR", value: 100 - (m.false_positive_rate ?? 0) * 100 },
    ];
  }, [runs]);

  const exportCsv = () => {
    const header = "ts,merchant,country,city,amount,fraud_score,status\n";
    const body = txns.map((t) => `${t.ts},${t.merchant},${t.country},${t.city},${t.amount},${t.fraud_score},${t.status}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "fraudshield-transactions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics & Reports</h1>
          <p className="text-sm text-muted-foreground">Model performance and fraud trends</p>
        </div>
        <Button onClick={exportCsv} variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-4">Model Comparison</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={compareData}>
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="precision" fill="oklch(0.78 0.18 195)" radius={[4,4,0,0]} />
              <Bar dataKey="recall" fill="oklch(0.65 0.22 305)" radius={[4,4,0,0]} />
              <Bar dataKey="f1" fill="oklch(0.78 0.17 142)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 text-xs mt-2 justify-center">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary"/>Precision</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent"/>Recall</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-cyber-success"/>F1</span>
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-4">Active Model Profile</h2>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="metric" stroke="var(--muted-foreground)" fontSize={11} />
              <Radar dataKey="value" stroke="oklch(0.78 0.18 195)" fill="oklch(0.78 0.18 195)" fillOpacity={0.4} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="p-5 border-b border-glass-border"><h2 className="font-semibold">Model Runs</h2></div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-glass-border">
            <tr>
              <th className="text-left px-4 py-3">Model</th>
              <th className="text-left px-4 py-3">Version</th>
              <th className="text-right px-4 py-3">Precision</th>
              <th className="text-right px-4 py-3">Recall</th>
              <th className="text-right px-4 py-3">F1</th>
              <th className="text-right px-4 py-3">AUC</th>
              <th className="text-right px-4 py-3">FPR</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const m = (r.metrics ?? {}) as Record<string, number>;
              return (
                <tr key={r.id} className="border-b border-glass-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.version}</td>
                  <td className="px-4 py-3 text-right font-mono">{((m.precision ?? 0)*100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right font-mono">{((m.recall ?? 0)*100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right font-mono">{((m.f1 ?? 0)*100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right font-mono">{((m.auc ?? 0)*100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right font-mono">{((m.false_positive_rate ?? 0)*100).toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    {r.is_active
                      ? <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border bg-cyber-success/15 text-cyber-success border-cyber-success/40">ACTIVE</span>
                      : <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border text-muted-foreground border-border">candidate</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
