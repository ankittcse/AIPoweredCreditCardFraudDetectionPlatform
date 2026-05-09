
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'analyst');
CREATE TYPE public.tx_status AS ENUM ('pending', 'approved', 'flagged', 'blocked');
CREATE TYPE public.alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.card_status AS ENUM ('active', 'blocked');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Cards
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last4 TEXT NOT NULL,
  holder TEXT NOT NULL,
  status public.card_status NOT NULL DEFAULT 'active',
  risk_score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  merchant TEXT NOT NULL,
  mcc TEXT,
  country TEXT,
  city TEXT,
  lat NUMERIC,
  lng NUMERIC,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  fraud_score NUMERIC NOT NULL DEFAULT 0,
  is_fraud_pred BOOLEAN NOT NULL DEFAULT false,
  is_fraud_true BOOLEAN,
  status public.tx_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_ts ON public.transactions(ts DESC);
CREATE INDEX idx_tx_status ON public.transactions(status);
CREATE INDEX idx_tx_score ON public.transactions(fraud_score DESC);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Alerts
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  severity public.alert_severity NOT NULL,
  message TEXT NOT NULL,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_created ON public.alerts(created_at DESC);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Model runs
CREATE TABLE public.model_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.model_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Profiles
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "roles_self_select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Cards: all authenticated read, admin manage
CREATE POLICY "cards_read" ON public.cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "cards_admin_manage" ON public.cards FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Transactions: all auth read; analyst+admin update; admin delete; system inserts via service role (no policy needed)
CREATE POLICY "tx_read" ON public.transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "tx_update" ON public.transactions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));
CREATE POLICY "tx_admin_delete" ON public.transactions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Alerts: read all, ack by analyst/admin
CREATE POLICY "alerts_read" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "alerts_update" ON public.alerts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));

-- Audit: admin read
CREATE POLICY "audit_admin_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Model runs: read all
CREATE POLICY "model_runs_read" ON public.model_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "model_runs_admin_manage" ON public.model_runs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: auto-create profile + first user becomes admin, others analyst
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NEW.email);

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'analyst');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.alerts REPLICA IDENTITY FULL;

-- Seed cards & a baseline model run
INSERT INTO public.cards (last4, holder, risk_score) VALUES
  ('4242','Alice Chen', 0.12),('1881','Marcus Reed', 0.34),('9036','Priya Shah', 0.08),
  ('5512','Diego Lopez', 0.55),('7700','Yuki Tanaka', 0.21),('3344','Sara Müller', 0.18),
  ('8821','Omar Hassan', 0.42),('1199','Liu Wei', 0.07),('6677','Eva Novak', 0.91),('2024','Jordan Blake', 0.27);

INSERT INTO public.model_runs (name, version, is_active, metrics) VALUES
('XGBoost Ensemble','v1.2.0', true, '{"precision":0.962,"recall":0.913,"f1":0.937,"auc":0.991,"false_positive_rate":0.018,"trained_on":284807,"fraud_samples":492}'::jsonb),
('Isolation Forest','v1.0.0', false, '{"precision":0.871,"recall":0.844,"f1":0.857,"auc":0.962,"false_positive_rate":0.041}'::jsonb),
('Logistic Regression','v1.0.0', false, '{"precision":0.792,"recall":0.681,"f1":0.732,"auc":0.911,"false_positive_rate":0.067}'::jsonb);
