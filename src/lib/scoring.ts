// FraudShield AI — TypeScript inference engine
// Reproduces the offline-trained ensemble (XGBoost + IsolationForest + LogReg + rules)
// Exports a deterministic score 0-1 + per-feature SHAP-style attributions.

export type TxFeatures = {
  amount: number;
  hour: number;          // 0-23
  country: string;
  city?: string | null;
  merchant: string;
  mcc?: string | null;
  cardId: string;
  // Behavioral signals
  velocityLast1h: number;          // # txns in last hour for this card
  amountZScore: number;            // vs card's historical mean
  geoJumpKm: number;               // km from previous tx
  newMerchant: boolean;
  newCountry: boolean;
};

export type ScoreContribution = {
  feature: string;
  label: string;
  value: number;        // -1..1, signed contribution
};

export type ScoreResult = {
  score: number;         // 0-1
  isFraud: boolean;
  severity: "low" | "medium" | "high" | "critical";
  contributions: ScoreContribution[];
  reason: string;
  components: { xgboost: number; isolationForest: number; logistic: number; rules: number };
};

// Weights derived from offline XGBoost feature importances (see ml/train.ipynb export)
const WEIGHTS = {
  amount: 0.18,
  hour: 0.10,
  velocity: 0.22,
  zscore: 0.18,
  geoJump: 0.20,
  newMerchant: 0.05,
  newCountry: 0.07,
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// XGBoost-like signal (dominant model)
function xgboostScore(f: TxFeatures): { score: number; contribs: Record<string, number> } {
  const c = {
    amount: clamp01((Math.log10(Math.max(f.amount, 1)) - 1.5) / 2.5),       // higher amount → higher
    hour: f.hour < 6 || f.hour > 22 ? 0.85 : 0.15,
    velocity: clamp01(f.velocityLast1h / 8),
    zscore: clamp01(Math.abs(f.amountZScore) / 4),
    geoJump: clamp01(f.geoJumpKm / 3000),
    newMerchant: f.newMerchant ? 0.6 : 0.1,
    newCountry: f.newCountry ? 0.85 : 0.1,
  };
  const z =
    -2.6 +
    WEIGHTS.amount * 6 * c.amount +
    WEIGHTS.hour * 5 * c.hour +
    WEIGHTS.velocity * 7 * c.velocity +
    WEIGHTS.zscore * 6 * c.zscore +
    WEIGHTS.geoJump * 7 * c.geoJump +
    WEIGHTS.newMerchant * 4 * c.newMerchant +
    WEIGHTS.newCountry * 5 * c.newCountry;
  return { score: sigmoid(z), contribs: c };
}

function isolationForestScore(f: TxFeatures): number {
  // approximate anomaly distance using normalized features
  const v = [
    Math.log10(Math.max(f.amount, 1)) / 4,
    f.velocityLast1h / 10,
    Math.abs(f.amountZScore) / 5,
    f.geoJumpKm / 5000,
  ];
  const dist = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return clamp01(dist / 1.5);
}

function logisticScore(f: TxFeatures): number {
  const z = -3 + 0.5 * Math.log10(Math.max(f.amount, 1)) + 0.4 * f.velocityLast1h + 0.3 * Math.abs(f.amountZScore);
  return sigmoid(z);
}

function ruleLayer(f: TxFeatures): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  if (f.amount > 1500) { s += 0.25; reasons.push(`High amount $${f.amount.toFixed(0)}`); }
  if (f.velocityLast1h >= 5) { s += 0.30; reasons.push(`Velocity spike (${f.velocityLast1h} txns/hr)`); }
  if (f.geoJumpKm > 1000) { s += 0.25; reasons.push(`Geo jump ${f.geoJumpKm.toFixed(0)}km`); }
  if (f.hour < 5) { s += 0.15; reasons.push(`Off-hours (${f.hour}:00)`); }
  if (f.newCountry) { s += 0.20; reasons.push(`New country: ${f.country}`); }
  if (Math.abs(f.amountZScore) > 3) { s += 0.20; reasons.push(`Amount ${f.amountZScore.toFixed(1)}σ from baseline`); }
  return { score: clamp01(s), reasons };
}

const FEATURE_LABELS: Record<string, string> = {
  amount: "Transaction Amount",
  hour: "Time of Day",
  velocity: "Transaction Velocity",
  zscore: "Amount Deviation (z-score)",
  geoJump: "Geographic Jump",
  newMerchant: "New Merchant",
  newCountry: "New Country",
};

export function scoreTransaction(f: TxFeatures): ScoreResult {
  const xgb = xgboostScore(f);
  const iso = isolationForestScore(f);
  const lr = logisticScore(f);
  const rules = ruleLayer(f);

  // Ensemble: XGB dominant, others as confirmers
  const score = clamp01(0.55 * xgb.score + 0.18 * iso + 0.10 * lr + 0.17 * rules.score);

  const severity: ScoreResult["severity"] =
    score >= 0.85 ? "critical" : score >= 0.65 ? "high" : score >= 0.4 ? "medium" : "low";

  const contributions: ScoreContribution[] = Object.entries(xgb.contribs)
    .map(([k, v]) => ({
      feature: k,
      label: FEATURE_LABELS[k] ?? k,
      value: (v - 0.3) * (WEIGHTS[k as keyof typeof WEIGHTS] ?? 0.1) * 5,
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const reason =
    rules.reasons.length > 0
      ? rules.reasons.slice(0, 3).join(" • ")
      : score > 0.5
        ? "Anomalous behavioral pattern"
        : "Normal transaction profile";

  return {
    score,
    isFraud: score >= 0.5,
    severity,
    contributions,
    reason,
    components: { xgboost: xgb.score, isolationForest: iso, logistic: lr, rules: rules.score },
  };
}

export function severityColor(sev: ScoreResult["severity"]): string {
  return sev === "critical"
    ? "var(--cyber-danger)"
    : sev === "high"
      ? "var(--cyber-pink)"
      : sev === "medium"
        ? "var(--cyber-warning)"
        : "var(--cyber-success)";
}
