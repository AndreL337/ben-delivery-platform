-- =============================================================================
-- BEN LOGISTICS (MILTON KEYNES 2-MAN BULKY PLATFORM)
-- Enterprise B-Tree Indexes, Server-Side 2026 Pricing Trigger & Stop Tracking
-- Migration: 20261104_enterprise_indexes_and_triggers.sql
-- (Guaranteed idempotent: adds any missing columns first, then creates indexes & triggers)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. DEFENSIVE COLUMN CREATION
-- Ensure `status` or other columns exist before creating indexes or triggers
-- -----------------------------------------------------------------------------

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS retailer_id UUID,
  ADD COLUMN IF NOT EXISTS driver_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Unassigned',
  ADD COLUMN IF NOT EXISTS requires_tail_lift BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_assembly BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_third_floor_no_lift BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS heavy_access_surcharge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pre_load_inspected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_drops_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exception_notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS job_id UUID,
  ADD COLUMN IF NOT EXISTS driver_id UUID,
  ADD COLUMN IF NOT EXISTS amount_pence INTEGER NOT NULL DEFAULT 38500,
  ADD COLUMN IF NOT EXISTS platform_fee_pence INTEGER NOT NULL DEFAULT 5500,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.contractor_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  agreement_version TEXT NOT NULL DEFAULT 'v1.0-pilot-outside-ir35',
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  lead_driver_name TEXT,
  has_right_of_substitution BOOLEAN DEFAULT TRUE,
  confirms_git_and_pl BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID,
  doc_type TEXT,
  file_url TEXT,
  expiry_date DATE,
  verified BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Pending Verification',
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT,
  event_type TEXT,
  summary TEXT,
  payload_meta TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 1. HIGH-PERFORMANCE B-TREE INDEXES FOR RLS & REALTIME QUERIES
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
-- 2. SERVER-SIDE 2026 PRICING MATRIX TRIGGER (ANTI-TAMPERING GUARDRAIL)
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
  ELSIF NEW.vehicle_setup = 'independent' AND NEW.loop_profile = 'assembly' THEN
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
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ben_2026_pricing();

-- -----------------------------------------------------------------------------
-- 3. SANITIZED PUBLIC CONSUMER TRACKING RPC (`?track=<job_id>`)
-- Uses TEXT parameter and ::text casts so it works whether `jobs.id` is TEXT,
-- BIGINT, or UUID without throwing 42883 type mismatch errors.
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
    j.drop_addresses,
    j.status,
    j.requires_tail_lift,
    j.requires_assembly,
    j.pre_load_inspected,
    j.completed_drops_json,
    j.exception_notes,
    j.created_at
  FROM public.jobs j
  WHERE j.id::text = p_job_id::text
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_job_tracking(TEXT) TO anon, authenticated;

COMMIT;
