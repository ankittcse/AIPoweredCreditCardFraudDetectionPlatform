
# FraudShield AI — Implementation Plan

A real-time credit card fraud detection platform with a futuristic cyber-security UI, live transaction stream, ML-powered scoring, and AI-generated explanations.

## Stack alignment (what we're actually shipping)

The original spec lists a Next.js + FastAPI + K8s + Kafka stack. Lovable runs on a different (but equally capable) modern stack. We'll deliver the same features and resume story on:

- **Frontend**: React 19 + TanStack Start, TypeScript, Tailwind v4, shadcn/ui, Framer Motion, Recharts
- **Backend**: TanStack server functions on Cloudflare Workers (replaces FastAPI)
- **Database / Auth / Realtime / Storage**: Lovable Cloud (Postgres + Auth + Realtime + Storage)
- **ML**: XGBoost trained offline in a Colab notebook on the Kaggle dataset → model coefficients + feature stats exported as JSON → inference runs in-app in TypeScript with real SHAP-style attributions
- **AI explanations**: Lovable AI Gateway (Gemini) generates natural-language "why this is suspicious" narratives
- **Repo deliverables**: `ml/` notebook, `docs/` architecture, README, Dockerfile for the offline training pipeline

The README will document this trade-off and call it out as an intentional edge-runtime architecture (a real resume talking point).

## Phases

We'll ship in 4 milestones so the preview is impressive at every step.

### Phase 1 — Design system & shell
- Cyber/glassmorphism theme: deep navy + neon cyan/violet, animated grid background, glow shadows
- Tokens in `src/styles.css` (oklch), no hard-coded colors
- Routes: `/` (landing), `/login`, `/dashboard`, `/transactions`, `/transactions/$id`, `/alerts`, `/analytics`, `/admin`, `/assistant`
- Shared shell: sidebar + topbar with live "system status" pulse, command palette
- Per-route SEO `head()` metadata

### Phase 2 — Cloud, auth, schema, seed
Enable Lovable Cloud. Auth: email/password + Google. Two roles via `user_roles` table + `has_role()` security-definer (Admin, Analyst).

Tables (all RLS-protected):
- `profiles` (id, display_name, created_at)
- `user_roles` (user_id, role enum: admin|analyst)
- `transactions` (id, card_id, amount, merchant, mcc, country, city, lat, lng, ts, features jsonb, fraud_score, is_fraud_pred, is_fraud_true, status enum: pending|approved|flagged|blocked)
- `alerts` (id, transaction_id, severity, message, acknowledged_by, acknowledged_at)
- `cards` (id, last4, holder, status: active|blocked, risk_score)
- `audit_logs` (id, user_id, action, target, meta, ts)
- `model_runs` (id, name, version, metrics jsonb, created_at) — populated from the Colab export

Seed: ~5,000 sampled rows from Kaggle CSV (committed as compressed JSON in `src/data/`) inserted on first boot.

### Phase 3 — ML pipeline & live scoring
- `ml/train.ipynb`: load Kaggle `creditcard.csv` → SMOTE → XGBoost + Isolation Forest + Logistic Regression baseline → Optuna tuning → SHAP global feature importances → export `model.json` (tree weights), `feature_stats.json`, `metrics.json`
- `src/lib/scoring.ts`: pure-TS XGBoost tree-walker that loads `model.json` and scores a transaction; produces score 0–1 + per-feature contributions (SHAP-style)
- `scoreTransaction` server function used by both the simulator and manual entry
- **Simulator**: server function + Postgres Realtime — inserts a synthetic transaction every 2–4s (mix of legit + injected fraud patterns), client subscribes via Realtime channel for live stream
- Ensemble vote: weighted average of XGBoost + IsoForest distance + rule layer (velocity, geo-jump, odd hour, amount z-score)

### Phase 4 — Feature surfaces

**Real-time dashboard** (`/dashboard`)
- KPI cards: TPS, fraud rate, blocked today, false-positive estimate
- Live transaction ticker (Framer Motion enter animations, color-coded by risk)
- Fraud trend area chart, risk-band donut, hourly heatmap
- Geo map of recent fraud (lightweight SVG world map, no Mapbox key needed)

**Transactions** (`/transactions`)
- Filterable/sortable table (status, risk, country, amount, date range)
- Detail page: full feature breakdown, SHAP bar chart, confidence gauge, AI explanation panel (streamed from Gemini), Approve / Flag / Block actions (writes audit log)

**Alerts** (`/alerts`)
- Real-time toast + alerts inbox, severity tags, acknowledge flow
- Optional email via Resend (asks for key only if user wants it)

**Analytics** (`/analytics`)
- Model comparison table (XGBoost vs IsoForest vs LogReg) from `model_runs.metrics`
- Precision/Recall/F1, confusion matrix, ROC curve (Recharts)
- CSV export

**Admin panel** (`/admin`, admin-only via `_authenticated/_admin` layout)
- User & role management, card block list, audit log viewer, "retrain" button (refreshes synthetic stats)

**AI Assistant** (`/assistant`)
- Chat UI (streaming) with Lovable AI; tool-aware prompt with access to recent fraud stats so it can answer "what's our top fraud pattern this week?"

## Technical details

**Routing**: separate route files per section (TanStack file-based). `_authenticated/` layout for auth gate, `_authenticated/_admin/` for role gate.

**Realtime**: enable Postgres Realtime on `transactions` and `alerts`. Client subscribes via browser Supabase client.

**Server functions** (`src/lib/*.functions.ts`):
- `scoring.functions.ts` — `scoreTransaction`, `simulateBatch`
- `ai.functions.ts` — `explainTransaction` (calls AI gateway, streams)
- `admin.functions.ts` — uses `supabaseAdmin` for role/card management
- `seed.functions.ts` — one-shot Kaggle seed loader

**Security**: roles in `user_roles` (never on profiles), all tables RLS-locked, admin actions via service-role client behind `requireSupabaseAuth` + role check, all writes logged to `audit_logs`.

**ML artifacts shipped in repo**:
```
ml/
  train.ipynb           # full Kaggle pipeline
  requirements.txt
  Dockerfile            # reproducible training env
  README.md
src/data/
  model.json            # exported XGBoost
  feature_stats.json    # means/stds for normalization
  metrics.json          # for /analytics
  sample_transactions.json.gz
docs/
  architecture.md       # diagram + data flow
  deployment.md
```

**Out of scope** (called out in README as future work, not built):
Kafka streaming, Twilio SMS (unless user adds key), Terraform/K8s/Prometheus/ELK (Lovable handles hosting), React Native app, blockchain audit log.

## What I need from you before building

1. Kaggle `creditcard.csv` is large (~150MB) — I'll commit a **stratified 5k-row sample** as compressed JSON. Full training notebook will reference the Kaggle URL. OK?
2. Email alerts via **Resend** — skip for now, or want me to wire it (you'd add the API key when prompted)?

If both are fine, I'll proceed in the order above starting with Phase 1.
