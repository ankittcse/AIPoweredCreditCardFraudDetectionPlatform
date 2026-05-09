import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, X, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RiskMeter, statusBadgeClasses, severityBadgeClasses } from "@/components/fraud-ui";
import { cn } from "@/lib/utils";
import { scoreTransaction, type TxFeatures } from "@/lib/scoring";
import type { Database } from "@/integrations/supabase/types";

type Tx = Database["public"]["Tables"]["transactions"]["Row"];

export const Route = createFileRoute("/_authenticated/transactions/$txId")({
  head: () => ({ meta: [{ title: "Transaction Detail — FraudShield AI" }] }),
  component: TxDetail,
});

function TxDetail() {
  const { txId } = Route.useParams();
  const nav = useNavigate();
  const [tx, setTx] = useState<Tx | null>(null);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    supabase.from("transactions").select("*").eq("id", txId).single().then(({ data }) => setTx(data));
  }, [txId]);

  const features = (tx?.features ?? null) as unknown as TxFeatures | null;
  const result = features ? scoreTransaction(features) : null;

  const explain = async () => {
    if (!tx || !result) return;
    setAiLoading(true); setAiText("");
    try {
      const resp = await fetch("/api/explain", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(tx.amount), merchant: tx.merchant, country: tx.country ?? "??",
          city: tx.city, fraud_score: Number(tx.fraud_score), reason: tx.reason ?? "",
          contributions: result.contributions.map((c) => ({ label: c.label, value: c.value })),
        }),
      });
      if (!resp.ok || !resp.body) {
        const t = await resp.text();
        toast.error(t || "AI request failed");
        return;
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") return;
          try {
            const p = JSON.parse(j);
            const c = p.choices?.[0]?.delta?.content;
            if (c) setAiText((prev) => prev + c);
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stream error");
    } finally { setAiLoading(false); }
  };

  const updateStatus = async (status: "approved" | "flagged" | "blocked") => {
    if (!tx) return;
    const { error } = await supabase.from("transactions").update({ status }).eq("id", tx.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked as ${status}`);
    setTx({ ...tx, status });
  };

  if (!tx || !result || !features) {
    return <div className="text-sm text-muted-foreground">Loading transaction…</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <button onClick={() => nav({ to: "/transactions" })} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to transactions
      </button>

      <div className="glass rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{tx.merchant}</h1>
              <span className={cn("text-[10px] uppercase font-mono px-2 py-0.5 rounded border", statusBadgeClasses(tx.status))}>{tx.status}</span>
              <span className={cn("text-[10px] uppercase font-mono px-2 py-0.5 rounded border", severityBadgeClasses(result.severity))}>{result.severity}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {tx.city}, {tx.country} • {new Date(tx.ts).toLocaleString()} • MCC {tx.mcc}
            </div>
            <div className="mt-3 text-3xl font-mono font-bold">${Number(tx.amount).toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Fraud Score</div>
            <div className="text-5xl font-bold font-mono text-gradient-cyber">{(Number(tx.fraud_score) * 100).toFixed(0)}<span className="text-2xl">%</span></div>
            <div className="mt-2 w-44"><RiskMeter score={Number(tx.fraud_score)} /></div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => updateStatus("approved")} variant="outline" size="sm" className="border-cyber-success/40 text-cyber-success">
            <Check className="h-4 w-4 mr-1" /> Approve
          </Button>
          <Button onClick={() => updateStatus("flagged")} variant="outline" size="sm" className="border-cyber-warning/40 text-cyber-warning">
            <ShieldAlert className="h-4 w-4 mr-1" /> Flag for review
          </Button>
          <Button onClick={() => updateStatus("blocked")} variant="outline" size="sm" className="border-cyber-danger/40 text-cyber-danger">
            <X className="h-4 w-4 mr-1" /> Block
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-3">Feature Contributions (SHAP)</h2>
          <div className="space-y-2">
            {result.contributions.map((c) => {
              const pos = c.value > 0;
              const w = Math.min(Math.abs(c.value) * 100, 100);
              return (
                <div key={c.feature}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{c.label}</span>
                    <span className={cn("font-mono", pos ? "text-cyber-danger" : "text-cyber-success")}>
                      {pos ? "+" : ""}{c.value.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                    <div className={cn("h-full", pos ? "ml-auto" : "")} style={{
                      width: `${w}%`,
                      background: pos ? "var(--cyber-danger)" : "var(--cyber-success)",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-5 border-t border-glass-border">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Ensemble breakdown</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(result.components).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{k}</span>
                  <span className="font-mono">{(v * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> AI Analyst Explanation</h2>
            <Button onClick={explain} disabled={aiLoading} size="sm" variant="outline">
              {aiLoading ? "Streaming…" : aiText ? "Regenerate" : "Explain with AI"}
            </Button>
          </div>
          {aiText ? (
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{aiText}</div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Click <span className="text-accent">Explain with AI</span> to generate a Gemini-powered analyst narrative on why this transaction was scored as it was.
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-glass-border">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Behavioral signals</h3>
            <ul className="text-xs space-y-1 font-mono">
              <li>velocity_1h: {features.velocityLast1h}</li>
              <li>amount_zscore: {features.amountZScore.toFixed(2)}</li>
              <li>geo_jump_km: {features.geoJumpKm.toFixed(0)}</li>
              <li>new_merchant: {String(features.newMerchant)}</li>
              <li>new_country: {String(features.newCountry)}</li>
              <li>hour: {features.hour}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
