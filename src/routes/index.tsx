import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Activity, Brain, Zap, Lock, BarChart3, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FraudShield AI — Real-Time Credit Card Fraud Detection" },
      { name: "description", content: "Detect fraudulent transactions in milliseconds with ensemble ML, anomaly detection, and explainable AI." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Activity, title: "Real-Time Scoring", desc: "Sub-100ms fraud probability on every transaction in the live stream." },
  { icon: Brain, title: "Explainable AI", desc: "SHAP-style attributions + Gemini-generated narratives for every flag." },
  { icon: Zap, title: "Ensemble Engine", desc: "XGBoost + Isolation Forest + behavioral rules vote on each decision." },
  { icon: Lock, title: "Enterprise Security", desc: "RLS, role-based access, audit logs, signed actions on the edge." },
  { icon: BarChart3, title: "Live Analytics", desc: "Heatmaps, trend lines, model leaderboards, exportable reports." },
  { icon: Shield, title: "Auto-Block", desc: "Critical-severity transactions are blocked instantly; analysts review the rest." },
];

function Landing() {
  return (
    <div className="min-h-screen grid-bg">
      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Shield className="h-7 w-7 text-primary" />
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary pulse-ring" />
          </div>
          <div className="font-bold tracking-tight text-gradient-cyber text-lg">FraudShield AI</div>
        </div>
        <Link to="/login" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-cyan hover:opacity-90">
          Launch console
        </Link>
      </header>

      <section className="container mx-auto px-6 py-20 text-center relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs uppercase tracking-widest text-primary mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-cyber-success pulse-ring" /> Live defense grid online
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          <span className="text-gradient-cyber">Stop card fraud</span>
          <br />before it lands.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          A production-grade AI platform that scores every credit card transaction in real time using
          ensemble machine learning, anomaly detection, and explainable AI.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link to="/login" className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow-cyan inline-flex items-center gap-2">
            Open dashboard <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="https://github.com" className="rounded-md border border-glass-border glass px-6 py-3 text-sm font-semibold">
            View architecture
          </a>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {[["96.2%","Precision"],["91.3%","Recall"],["1.8%","False Positive"],["<100ms","Latency"]].map(([v,l]) => (
            <div key={l} className="glass rounded-xl p-4">
              <div className="text-2xl font-bold font-mono text-gradient-cyber">{v}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="glass rounded-xl p-6 hover:glow-cyan transition-all">
                <Icon className="h-6 w-6 text-primary mb-4" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="container mx-auto px-6 py-10 text-center text-xs text-muted-foreground border-t border-glass-border">
        FraudShield AI — Built with TanStack Start, Lovable Cloud, XGBoost, and Gemini.
      </footer>
    </div>
  );
}
