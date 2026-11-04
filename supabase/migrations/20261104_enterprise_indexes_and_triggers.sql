-- =============================================================================
-- BEN LOGISTICS (MILTON KEYNES 2-MAN BULKY PLATFORM)
-- Enterprise B-Tree Indexes, Server-Side 2026 Pricing Trigger & Stop Tracking
-- Migration: 20261104_enterprise_indexes_and_triggers.sql
-- =============================================================================

BEGIN;

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
-- 2. EXTENDED ENTERPRISE COLUMNS ON `public.jobs`
-- -----------------------------------------------------------------------------

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS has_third_floor_no_lift BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS heavy_access_surcharge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pre_load_inspected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_drops_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exception_notes TEXT;

-- -----------------------------------------------------------------------------
-- 3. SERVER-SIDE 2026 PRICING MATRIX TRIGGER (ANTI-TAMPERING GUARDRAIL)
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
-- 4. SANITIZED PUBLIC CONSUMER TRACKING RPC (`?track=<job_id>`)
-- Allows unauthenticated end-customers with a valid job UUID to view live ETA
-- without exposing full `public.jobs` rows to `anon` SELECT.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_job_tracking(p_job_id UUID)
RETURNS TABLE (
  id UUID,
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
    j.id,
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
  WHERE j.id = p_job_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_job_tracking(UUID) TO anon, authenticated;

COMMIT;
