import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  amount: z.number(),
  merchant: z.string(),
  country: z.string(),
  city: z.string().nullable().optional(),
  fraud_score: z.number(),
  reason: z.string(),
  contributions: z.array(z.object({ label: z.string(), value: z.number() })),
});

// Streams a natural-language explanation for a flagged transaction.
// Returns the gateway SSE stream directly to the client.
export const explainTransaction = createServerFn({ method: "POST", response: "raw" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { "content-type": "application/json" },
      });
    }

    const topFactors = data.contributions
      .slice(0, 5)
      .map((c) => `- ${c.label}: ${c.value > 0 ? "+" : ""}${c.value.toFixed(2)}`)
      .join("\n");

    const prompt = `You are a senior fraud analyst at a major bank. A transaction was scored ${(data.fraud_score * 100).toFixed(1)}% likely to be fraud.

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
        messages: [
          { role: "system", content: "You are a precise, calm senior fraud analyst. No hedging." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (resp.status === 429) return new Response("Rate limited. Try again shortly.", { status: 429 });
    if (resp.status === 402) return new Response("AI credits exhausted. Add credits in workspace.", { status: 402 });
    if (!resp.ok || !resp.body) return new Response("AI gateway error", { status: 500 });

    return new Response(resp.body, { headers: { "content-type": "text/event-stream" } });
  });
