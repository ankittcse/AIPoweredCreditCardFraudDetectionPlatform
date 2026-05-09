import { cn } from "@/lib/utils";

export function StatCard({
  label, value, sub, accent = "cyan", icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "cyan" | "violet" | "danger" | "success" | "warning";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const glowClass = accent === "cyan" ? "glow-cyan" : accent === "violet" ? "glow-violet" : accent === "danger" ? "glow-danger" : "";
  const colorVar =
    accent === "danger" ? "text-cyber-danger" :
    accent === "success" ? "text-cyber-success" :
    accent === "warning" ? "text-cyber-warning" :
    accent === "violet" ? "text-accent" : "text-primary";

  return (
    <div className={cn("glass rounded-xl p-5 relative overflow-hidden", glowClass)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className={cn("mt-2 text-3xl font-bold font-mono", colorVar)}>{value}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        {Icon && <Icon className={cn("h-5 w-5 opacity-70", colorVar)} />}
      </div>
      <div className="absolute -bottom-1 left-0 right-0 h-px shimmer opacity-60" />
    </div>
  );
}

export function severityBadgeClasses(sev: string) {
  switch (sev) {
    case "critical": return "bg-cyber-danger/15 text-cyber-danger border-cyber-danger/40";
    case "high": return "bg-cyber-pink/15 text-cyber-pink border-cyber-pink/40";
    case "medium": return "bg-cyber-warning/15 text-cyber-warning border-cyber-warning/40";
    default: return "bg-cyber-success/15 text-cyber-success border-cyber-success/40";
  }
}

export function statusBadgeClasses(status: string) {
  switch (status) {
    case "blocked": return "bg-cyber-danger/15 text-cyber-danger border-cyber-danger/40";
    case "flagged": return "bg-cyber-warning/15 text-cyber-warning border-cyber-warning/40";
    case "approved": return "bg-cyber-success/15 text-cyber-success border-cyber-success/40";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function RiskMeter({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.85 ? "var(--cyber-danger)" : score >= 0.65 ? "var(--cyber-pink)" : score >= 0.4 ? "var(--cyber-warning)" : "var(--cyber-success)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <span className="text-xs font-mono w-10 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}
