import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })),
  context: z.object({
    totalTx: z.number(),
    fraudCount: z.number(),
    blockedCount: z.number(),
    avgScore: z.number(),
    topCountries: z.array(z.object({ country: z.string(), count: z.number() })),
  }).optional(),
});

export const fraudChat = createServerFn({ method: "POST", response: "raw" })
  .inputValidator((input: unknown) => ChatSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return new Response("LOVABLE_API_KEY missing", { status: 500 });

    const ctxBlock = data.context
      ? `\nLive platform stats (last hour):
- Total transactions: ${data.context.totalTx}
- Predicted fraud: ${data.context.fraudCount}
- Auto-blocked: ${data.context.blockedCount}
- Avg fraud score: ${(data.context.avgScore * 100).toFixed(1)}%
- Top countries by volume: ${data.context.topCountries.map((c) => `${c.country}(${c.count})`).join(", ")}`
      : "";

    const system = `You are FraudShield AI's in-app analyst assistant. Answer questions about fraud patterns, model behavior, and what actions to take. Be concise, technical, confident.${ctxBlock}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (resp.status === 429) return new Response("Rate limited", { status: 429 });
    if (resp.status === 402) return new Response("AI credits exhausted", { status: 402 });
    if (!resp.ok || !resp.body) return new Response("AI error", { status: 500 });
    return new Response(resp.body, { headers: { "content-type": "text/event-stream" } });
  });
