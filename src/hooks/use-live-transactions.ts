import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateTransaction } from "@/lib/simulator";
import type { Database } from "@/integrations/supabase/types";

type Tx = Database["public"]["Tables"]["transactions"]["Row"];

// Drives the live demo: subscribes to realtime AND pushes synthetic txns
// from the client every few seconds. Only one client tab actually inserts
// (uses sessionStorage lock) to avoid duplicate writes.
export function useLiveTransactions(limit = 50) {
  const [txns, setTxns] = useState<Tx[]>([]);
  const [cardIds, setCardIds] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load
  useEffect(() => {
    supabase.from("transactions").select("*").order("ts", { ascending: false }).limit(limit).then(({ data }) => {
      if (data) setTxns(data);
    });
    supabase.from("cards").select("id").then(({ data }) => {
      if (data) setCardIds(data.map((c) => c.id));
    });
  }, [limit]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("tx-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
        setTxns((prev) => [payload.new as Tx, ...prev].slice(0, limit));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [limit]);

  // Simulator: client-side, lock so only one tab generates
  useEffect(() => {
    if (cardIds.length === 0) return;
    const lockKey = "fraudshield-simulator-lock";
    const myId = Math.random().toString(36).slice(2);
    const claim = () => {
      const cur = localStorage.getItem(lockKey);
      const [id, ts] = cur ? cur.split(":") : ["", "0"];
      if (!id || Date.now() - Number(ts) > 5000) {
        localStorage.setItem(lockKey, `${myId}:${Date.now()}`);
        return true;
      }
      return id === myId;
    };

    intervalRef.current = setInterval(async () => {
      if (!claim()) return;
      localStorage.setItem(lockKey, `${myId}:${Date.now()}`);
      const tx = generateTransaction(cardIds, Math.random() < 0.20);
      const { data: inserted } = await supabase.from("transactions").insert({
        card_id: tx.card_id,
        amount: tx.amount,
        merchant: tx.merchant,
        mcc: tx.mcc,
        country: tx.country,
        city: tx.city,
        lat: tx.lat,
        lng: tx.lng,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        features: tx.features as any,
        fraud_score: tx.fraud_score,
        is_fraud_pred: tx.is_fraud_pred,
        status: tx.status,
        reason: tx.reason,
      }).select().single();

      if (inserted && tx.fraud_score >= 0.65) {
        await supabase.from("alerts").insert({
          transaction_id: inserted.id,
          severity: tx.fraud_score >= 0.85 ? "critical" : "high",
          message: `${tx.merchant} • $${tx.amount.toFixed(2)} • ${tx.city}, ${tx.country} — ${tx.reason}`,
        });
      }
    }, 3500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cardIds]);

  return txns;
}
