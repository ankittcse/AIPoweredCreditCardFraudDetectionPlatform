import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, ShieldX, TrendingUp, Globe2 } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { StatCard, RiskMeter, statusBadgeClasses } from "@/components/fraud-ui";
import { useLiveTransactions } from "@/hooks/use-live-transactions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Live Dashboard — FraudShield AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const txns = useLiveTransactions(60);

  const stats = useMemo(() => {
    const total = txns.length;
    const fraud = txns.filter((t) => t.is_fraud_pred).length;
    const blocked = txns.filter((t) => t.status === "blocked").length;
    const avg = total > 0 ? txns.reduce((s, t) => s + Number(t.fraud_score), 0) / total : 0;
    return { total, fraud, blocked, avg, rate: total > 0 ? (fraud / total) * 100 : 0 };
  }, [txns]);

  const trendData = useMemo(() => {
    const buckets: Record<string, { time: string; total: number; fraud: number }> = {};
    txns.forEach((t) => {
      const d = new Date(t.ts);
      const key = `${d.getHours().toString().padStart(2, "0")}:${Math.floor(d.getMinutes() / 5) * 5}`.padEnd(5, "0");
      buckets[key] ??= { time: key, total: 0, fraud: 0 };
      buckets[key].total += 1;
      if (t.is_fraud_pred) buckets[key].fraud += 1;
    });
    return Object.values(buckets).sort((a, b) => a.time.localeCompare(b.time)).slice(-12);
  }, [txns]);

  const riskBands = useMemo(() => {
    const bands = [
      { name: "Critical", value: 0, color: "var(--cyber-danger)" },
      { name: "High", value: 0, color: "var(--cyber-pink)" },
      { name: "Medium", value: 0, color: "var(--cyber-warning)" },
      { name: "Low", value: 0, color: "var(--cyber-success)" },
    ];
    txns.forEach((t) => {
      const s = Number(t.fraud_score);
      if (s >= 0.85) bands[0].value++;
      else if (s >= 0.65) bands[1].value++;
      else if (s >= 0.4) bands[2].value++;
      else bands[3].value++;
    });
    return bands.filter((b) => b.value > 0);
  }, [txns]);

  const geoCounts = useMemo(() => {
    const m = new Map<string, number>();
    txns.filter((t) => t.is_fraud_pred).forEach((t) => m.set(t.country ?? "??", (m.get(t.country ?? "??") ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [txns]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Real-Time Fraud Grid</h1>
        <p className="text-sm text-muted-foreground">Live transaction stream with ensemble ML scoring</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Transactions" value={stats.total} sub="last 60 events" icon={Activity} />
        <StatCard label="Fraud Rate" value={`${stats.rate.toFixed(1)}%`} sub={`${stats.fraud} flagged`} accent="warning" icon={AlertTriangle} />
        <StatCard label="Auto-Blocked" value={stats.blocked} sub="critical severity" accent="danger" icon={ShieldX} />
        <StatCard label="Avg Risk Score" value={`${(stats.avg * 100).toFixed(0)}%`} sub="ensemble output" accent="violet" icon={TrendingUp} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Fraud Trend (5-min buckets)</h2>
            <span className="text-xs text-muted-foreground">live</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.78 0.18 195)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="oklch(0.78 0.18 195)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.27 27)" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="oklch(0.65 0.27 27)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Area type="monotone" dataKey="total" stroke="oklch(0.78 0.18 195)" fill="url(#g1)" />
              <Area type="monotone" dataKey="fraud" stroke="oklch(0.65 0.27 27)" fill="url(#g2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-4">Risk Distribution</h2>
          {riskBands.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              Waiting for transactions…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={riskBands} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {riskBands.map((b) => <Cell key={b.name} fill={b.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
            {riskBands.map((b) => (
              <div key={b.name} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                <span className="text-muted-foreground">{b.name}</span>
                <span className="ml-auto font-mono">{b.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <h2 className="font-semibold mb-4 flex items-center justify-between">
            <span>Live Transaction Stream</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyber-success pulse-ring" /> streaming
            </span>
          </h2>
          <div className="space-y-1 max-h-[480px] overflow-y-auto">
            <AnimatePresence initial={false}>
              {txns.slice(0, 20).map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: -16, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Link
                    to="/transactions/$txId"
                    params={{ txId: t.id }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-glass-border transition-all"
                  >
                    <span className={cn("text-[10px] uppercase font-mono px-2 py-0.5 rounded border", statusBadgeClasses(t.status))}>
                      {t.status}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{t.merchant}</div>
                      <div className="text-xs text-muted-foreground">{t.city}, {t.country} • {new Date(t.ts).toLocaleTimeString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">${Number(t.amount).toFixed(2)}</div>
                    </div>
                    <div className="w-28">
                      <RiskMeter score={Number(t.fraud_score)} />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
            {txns.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">Initializing stream…</div>
            )}
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Globe2 className="h-4 w-4" /> Top Fraud Geos
          </h2>
          <div className="space-y-3">
            {geoCounts.length === 0 ? (
              <div className="text-sm text-muted-foreground">No fraud detected yet</div>
            ) : geoCounts.map(([country, count]) => (
              <div key={country}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono">{country}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(count / geoCounts[0][1]) * 100}%`,
                      background: "var(--gradient-danger)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
