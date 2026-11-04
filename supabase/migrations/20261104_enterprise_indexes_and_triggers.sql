-- =============================================================================
-- BEN LOGISTICS (MILTON KEYNES 2-MAN BULKY PLATFORM)
-- Consolidated Production Schema, Triggers, B-Tree Indexes, RPC & RLS Policies
-- Target Instance: London Supabase (taqwjalqflxxuskschzc)
-- Migration: 20261104_enterprise_indexes_and_triggers.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CONSOLIDATED IDEMPOTENT SCHEMA & COLUMN GUARANTEES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID,
  driver_id UUID,
  status TEXT DEFAULT 'Unassigned',
  vehicle_setup TEXT DEFAULT 'independent',
  loop_profile TEXT DEFAULT 'roc',
  requires_tail_lift BOOLEAN DEFAULT FALSE,
  requires_assembly BOOLEAN DEFAULT FALSE,
  has_third_floor_no_lift BOOLEAN DEFAULT FALSE,
  heavy_access_surcharge NUMERIC(10, 2) DEFAULT 0.00,
  pickup_address TEXT,
  drop_addresses TEXT DEFAULT '[]',
  gross_fee NUMERIC(10, 2) DEFAULT 440.00,
  platform_fee NUMERIC(10, 2) DEFAULT 55.00,
  net_pool NUMERIC(10, 2) DEFAULT 385.00,
  pre_load_inspected BOOLEAN DEFAULT FALSE,
  completed_drops_json JSONB DEFAULT '[]'::jsonb,
  pod_image_url TEXT,
  signature_svg TEXT,
  exception_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS retailer_id UUID,
  ADD COLUMN IF NOT EXISTS driver_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Unassigned',
  ADD COLUMN IF NOT EXISTS vehicle_setup TEXT DEFAULT 'independent',
  ADD COLUMN IF NOT EXISTS loop_profile TEXT DEFAULT 'roc',
  ADD COLUMN IF NOT EXISTS requires_tail_lift BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_assembly BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_third_floor_no_lift BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS heavy_access_surcharge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS drop_addresses TEXT,
  ADD COLUMN IF NOT EXISTS gross_fee NUMERIC(10, 2) DEFAULT 440.00,
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(10, 2) DEFAULT 55.00,
  ADD COLUMN IF NOT EXISTS net_pool NUMERIC(10, 2) DEFAULT 385.00,
  ADD COLUMN IF NOT EXISTS pre_load_inspected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_drops_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pod_image_url TEXT,
  ADD COLUMN IF NOT EXISTS signature_svg TEXT,
  ADD COLUMN IF NOT EXISTS exception_notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.jobs ALTER COLUMN created_at SET DEFAULT NOW();
UPDATE public.jobs SET created_at = NOW() WHERE created_at IS NULL;

CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT,
  driver_id UUID,
  amount_pence INTEGER NOT NULL DEFAULT 38500,
  platform_fee_pence INTEGER NOT NULL DEFAULT 5500,
  status TEXT DEFAULT 'pending',
  total_charged_to_retailer NUMERIC(10, 2),
  driver_payout NUMERIC(10, 2),
  payout_status TEXT DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS job_id TEXT,
  ADD COLUMN IF NOT EXISTS driver_id UUID,
  ADD COLUMN IF NOT EXISTS amount_pence INTEGER NOT NULL DEFAULT 38500,
  ADD COLUMN IF NOT EXISTS platform_fee_pence INTEGER NOT NULL DEFAULT 5500,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS total_charged_to_retailer NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS driver_payout NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT,
  raised_by TEXT,
  raised_by_role TEXT,
  category TEXT DEFAULT 'other',
  description TEXT,
  status TEXT DEFAULT 'awaiting_response',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'awaiting_response',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.contractor_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  agreement_version TEXT NOT NULL DEFAULT 'v1.0-pilot-outside-ir35',
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  lead_driver_name TEXT NOT NULL DEFAULT 'MK Verified Crew Lead',
  has_right_of_substitution BOOLEAN NOT NULL DEFAULT TRUE,
  confirms_git_and_pl BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID,
  doc_type TEXT NOT NULL DEFAULT 'goods_in_transit',
  file_url TEXT NOT NULL DEFAULT '',
  expiry_date DATE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Pending Verification',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_meta TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agent_events
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- -----------------------------------------------------------------------------
-- 2. HIGH-PERFORMANCE B-TREE INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_jobs_retailer_id ON public.jobs(retailer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_driver_id ON public.jobs(driver_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at_desc ON public.jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payouts_job_id ON public.payouts(job_id);
CREATE INDEX IF NOT EXISTS idx_payouts_driver_id ON public.payouts(driver_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);

CREATE INDEX IF NOT EXISTS idx_contractor_agreements_user_id ON public.contractor_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_driver_id ON public.compliance_documents(driver_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_agent_events_status_created ON public.agent_events(status, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. SERVER-SIDE 2026 PRICING MATRIX TRIGGER (INSERT OR UPDATE)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_ben_2026_pricing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_gross NUMERIC(10, 2);
  base_fee NUMERIC(10, 2);
  base_net NUMERIC(10, 2);
  access_surcharge NUMERIC(10, 2);
BEGIN
  -- Ensure created_at and status defaults are always populated
  NEW.created_at := COALESCE(NEW.created_at, NOW());
  NEW.status := COALESCE(NULLIF(NEW.status, ''), 'Unassigned');

  -- 1. Determine base 2026 flat rate (12.5% Ben Fee / 87.5% Crew Net Pool)
  IF NEW.loop_profile = 'overflow' THEN
    base_gross := 145.00;
    base_fee := 18.13;
    base_net := 126.87;
  ELSIF NEW.vehicle_setup = 'clientVehicle' AND NEW.loop_profile = 'roc' THEN
    base_gross := 350.00;
    base_fee := 43.75;
    base_net := 306.25;
  ELSIF NEW.vehicle_setup = 'clientVehicle' AND NEW.loop_profile = 'assembly' THEN
    base_gross := 410.00;
    base_fee := 51.25;
    base_net := 358.75;
  ELSIF NEW.vehicle_setup IN ('independent', 'independent_35t') AND NEW.loop_profile = 'assembly' THEN
    base_gross := 520.00;
    base_fee := 65.00;
    base_net := 455.00;
  ELSE
    -- Default: Independent 3.5t Luton (2-Man) — Standard ROC
    base_gross := 440.00;
    base_fee := 55.00;
    base_net := 385.00;
  END IF;

  -- 2. Apply £25 heavy-access surcharge (3rd floor+ without lift -> 100% to crew)
  IF COALESCE(NEW.has_third_floor_no_lift, FALSE) THEN
    access_surcharge := 25.00;
  ELSE
    access_surcharge := COALESCE(NEW.heavy_access_surcharge, 0.00);
  END IF;

  NEW.heavy_access_surcharge := access_surcharge;
  NEW.gross_fee := base_gross + access_surcharge;
  NEW.platform_fee := base_fee;
  NEW.net_pool := base_net + access_surcharge;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ben_2026_pricing ON public.jobs;
CREATE TRIGGER trg_enforce_ben_2026_pricing
  BEFORE INSERT OR UPDATE OF vehicle_setup, loop_profile, has_third_floor_no_lift ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ben_2026_pricing();

-- -----------------------------------------------------------------------------
-- 4. SANITIZED PUBLIC CONSUMER TRACKING RPC (`?track=<job_id>`)
-- Safely handles UUID or integer IDs via explicit ::text casting (no 42883 error)
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_public_job_tracking(UUID);
DROP FUNCTION IF EXISTS public.get_public_job_tracking(TEXT);

CREATE OR REPLACE FUNCTION public.get_public_job_tracking(p_job_id TEXT)
RETURNS TABLE (
  id TEXT,
  pickup_address TEXT,
  drop_addresses TEXT,
  status TEXT,
  requires_tail_lift BOOLEAN,
  requires_assembly BOOLEAN,
  pre_load_inspected BOOLEAN,
  completed_drops_json JSONB,
  exception_notes TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    j.id::text AS id,
    j.pickup_address,
    j.drop_addresses::text AS drop_addresses,
    j.status,
    COALESCE(j.requires_tail_lift, false) AS requires_tail_lift,
    COALESCE(j.requires_assembly, false) AS requires_assembly,
    COALESCE(j.pre_load_inspected, false) AS pre_load_inspected,
    COALESCE(j.completed_drops_json, '[]'::jsonb) AS completed_drops_json,
    j.exception_notes,
    COALESCE(j.created_at, NOW()) AS created_at
  FROM public.jobs j
  WHERE j.id::text = TRIM(p_job_id)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_job_tracking(TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. RLS POLICIES FOR RETAILER JOB CREATION, PAYOUTS & DISPUTES
-- -----------------------------------------------------------------------------

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.jobs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payouts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.disputes TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

DROP POLICY IF EXISTS "Retailers select own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Retailers insert own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Retailers update own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Crews select open or assigned jobs" ON public.jobs;
DROP POLICY IF EXISTS "Crews update assigned jobs" ON public.jobs;
DROP POLICY IF EXISTS "Pilot jobs read access" ON public.jobs;
DROP POLICY IF EXISTS "Pilot jobs insert access" ON public.jobs;
DROP POLICY IF EXISTS "Pilot jobs update access" ON public.jobs;

CREATE POLICY "Pilot jobs read access"
  ON public.jobs FOR SELECT TO anon, authenticated
  USING (
    status IN ('open', 'Unassigned', 'draft', 'Assigned', 'assigned', 'In Progress', 'in_transit', 'Completed', 'delivered')
    OR retailer_id::text = COALESCE(auth.uid()::text, retailer_id::text)
    OR driver_id::text = COALESCE(auth.uid()::text, driver_id::text)
  );

CREATE POLICY "Pilot jobs insert access"
  ON public.jobs FOR INSERT TO anon, authenticated
  WITH CHECK (
    auth.uid() IS NULL
    OR retailer_id IS NULL
    OR retailer_id::text = auth.uid()::text
    OR retailer_id::text = '00000000-0000-0000-0000-000000000001'
  );

CREATE POLICY "Pilot jobs update access"
  ON public.jobs FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Crews select own payouts" ON public.payouts;
DROP POLICY IF EXISTS "Retailers insert payouts on job creation" ON public.payouts;
DROP POLICY IF EXISTS "Admins full access on payouts" ON public.payouts;

CREATE POLICY "Retailers insert payouts on job creation"
  ON public.payouts FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Crews select own payouts"
  ON public.payouts FOR SELECT TO authenticated
  USING (
    driver_id IS NULL
    OR driver_id::text = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id::text = auth.uid()::text)
  );

DROP POLICY IF EXISTS "Authenticated users read disputes" ON public.disputes;
DROP POLICY IF EXISTS "Authenticated users insert disputes" ON public.disputes;

CREATE POLICY "Authenticated users read disputes"
  ON public.disputes FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users insert disputes"
  ON public.disputes FOR INSERT TO anon, authenticated
  WITH CHECK (true);
