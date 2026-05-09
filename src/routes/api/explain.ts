import { createFileRoute } from "@tanstack/react-router";

const SYSTEM = "You are a precise, calm senior fraud analyst. No hedging.";

export const Route = createFileRoute("/api/explain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("LOVABLE_API_KEY not configured", { status: 500 });

        const data = await request.json() as {
          amount: number; merchant: string; country: string; city?: string | null;
          fraud_score: number; reason: string;
          contributions: { label: string; value: number }[];
        };

        const topFactors = (data.contributions ?? []).slice(0, 5)
          .map((c) => `- ${c.label}: ${c.value > 0 ? "+" : ""}${c.value.toFixed(2)}`).join("\n");

        const prompt = `A transaction was scored ${(data.fraud_score * 100).toFixed(1)}% likely to be fraud.

Transaction:
- Amount: $${data.amount.toFixed(2)}
- Merchant: ${data.merchant}
- Location: ${data.city ?? "Unknown"}, ${data.country}

Rule signals: ${data.reason}

Top SHAP-style feature contributions (positive = pushes toward fraud):
${topFactors}

Write a concise 3-4 sentence explanation for the analyst. Be specific about which signals matter most and why. Do not hedge. End with a one-line recommendation (BLOCK / FLAG FOR REVIEW / APPROVE).`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: true,
            messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
          }),
        });

        if (resp.status === 429) return new Response("Rate limited. Try again shortly.", { status: 429 });
        if (resp.status === 402) return new Response("AI credits exhausted.", { status: 402 });
        if (!resp.ok || !resp.body) return new Response("AI gateway error", { status: 500 });
        return new Response(resp.body, { headers: { "content-type": "text/event-stream" } });
      },
    },
  },
});
