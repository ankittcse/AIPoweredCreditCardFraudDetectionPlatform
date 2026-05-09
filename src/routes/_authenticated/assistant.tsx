import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant — FraudShield AI" }] }),
  component: Assistant,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What's our top fraud pattern this hour?",
  "Why is the false-positive rate trending up?",
  "Should we lower the auto-block threshold?",
  "Summarize the riskiest cards in the last 24h.",
];

function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");

    // Build context
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase.from("transactions").select("*").gte("ts", since);
    const context = recent ? {
      totalTx: recent.length,
      fraudCount: recent.filter((t) => t.is_fraud_pred).length,
      blockedCount: recent.filter((t) => t.status === "blocked").length,
      avgScore: recent.length > 0 ? recent.reduce((s, t) => s + Number(t.fraud_score), 0) / recent.length : 0,
      topCountries: Object.entries(recent.reduce<Record<string, number>>((acc, t) => {
        const k = t.country ?? "??"; acc[k] = (acc[k] ?? 0) + 1; return acc;
      }, {})).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    } : undefined;

    let assistantContent = "";
    setMessages([...next, { role: "assistant", content: "" }]);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context }),
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
            if (c) {
              assistantContent += c;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: assistantContent };
                return copy;
              });
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stream error");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-6 w-6 text-accent" /> AI Fraud Assistant
        </h1>
        <p className="text-sm text-muted-foreground">Powered by Gemini with live access to your fraud grid stats</p>
      </div>

      <div className="glass rounded-xl flex flex-col h-[calc(100vh-260px)] min-h-[400px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <Sparkles className="h-10 w-10 text-accent" />
              <div className="text-muted-foreground text-sm max-w-md">
                Ask anything about fraud patterns, model decisions, or what action to take. The assistant has live access to platform stats.
              </div>
              <div className="grid sm:grid-cols-2 gap-2 mt-4 max-w-2xl">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="glass rounded-lg p-3 text-left text-sm hover:glow-violet transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
              {m.role === "assistant" && <Bot className="h-6 w-6 text-accent mt-1 shrink-0" />}
              <div className={cn(
                "rounded-xl px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap leading-relaxed",
                m.role === "user" ? "bg-primary/15 border border-primary/30" : "glass"
              )}>
                {m.content || <span className="opacity-60">Thinking…</span>}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="p-3 border-t border-glass-border flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the AI…" disabled={busy} />
          <Button type="submit" disabled={busy || !input.trim()} className="glow-violet">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
