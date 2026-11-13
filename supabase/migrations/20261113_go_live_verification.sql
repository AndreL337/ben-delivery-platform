-- =============================================================================
-- BEN LOGISTICS: PRE-OUTREACH GO-LIVE SECURITY VERIFICATION & CLEAN PRODUCTION STATE
-- Migration: 20261113_go_live_verification.sql
-- Target Project: taqwjalqflxxuskschzc (benlogistics.co.uk)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ENFORCE ROW-LEVEL SECURITY (RLS) ACROSS ALL PROTECTED TABLES
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contractor_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.drivers_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.location_blackbook ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. REVOKE ANON READ/WRITE PRIVILEGES ON PROTECTED TABLES
--    Allow `anon` ONLY to INSERT into `drivers_waitlist` and execute the
--    tokenized read-only consumer tracking RPC (`get_public_job_tracking`).
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.jobs FROM anon;
REVOKE ALL ON public.payouts FROM anon;
REVOKE ALL ON public.disputes FROM anon;
REVOKE ALL ON public.ratings FROM anon;
REVOKE ALL ON public.dispute_messages FROM anon;
REVOKE ALL ON public.compliance_documents FROM anon;
REVOKE ALL ON public.contractor_agreements FROM anon;
REVOKE ALL ON public.agent_events FROM anon;
REVOKE ALL ON public.location_blackbook FROM anon;

REVOKE SELECT, UPDATE, DELETE, TRUNCATE ON public.drivers_waitlist FROM anon;
GRANT INSERT ON public.drivers_waitlist TO anon, authenticated;

-- Ensure tokenized public tracking RPC remains executable by anon/authenticated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_public_job_tracking'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.get_public_job_tracking(TEXT) TO anon, authenticated;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. CLEAN PRODUCTION STATE: PURGE LEFTOVER SMOKE-TEST & DUMMY ROWS
--    Preserves clean pilot auth accounts (`retailer@benlogistics.co.uk`,
--    `pilot.retailer@benlogistics.co.uk`, `driver@benlogistics.co.uk`,
--    `pilot.driver@benlogistics.co.uk`) and their Gate A6 / compliance records.
-- -----------------------------------------------------------------------------
DELETE FROM public.dispute_messages
WHERE dispute_id IN (
  SELECT id FROM public.disputes
  WHERE reason ILIKE '%smoke%'
     OR reason ILIKE '%test%'
     OR reason ILIKE '%dummy%'
     OR reason ILIKE '%diag%'
);

DELETE FROM public.disputes
WHERE reason ILIKE '%smoke%'
   OR reason ILIKE '%test%'
   OR reason ILIKE '%dummy%'
   OR reason ILIKE '%diag%';

DELETE FROM public.payouts
WHERE job_id IN (
  SELECT id FROM public.jobs
  WHERE pickup_address ILIKE '%smoke%'
     OR pickup_address ILIKE '%test%'
     OR pickup_address ILIKE '%dummy%'
     OR drop_addresses ILIKE '%smoke%'
     OR retailer_id::text = '00000000-0000-0000-0000-000000000001'
);

DELETE FROM public.jobs
WHERE pickup_address ILIKE '%smoke%'
   OR pickup_address ILIKE '%test%'
   OR pickup_address ILIKE '%dummy%'
   OR drop_addresses ILIKE '%smoke%'
   OR retailer_id::text = '00000000-0000-0000-0000-000000000001';

DELETE FROM public.agent_events
WHERE summary ILIKE '%smoke%'
   OR summary ILIKE '%test%'
   OR summary ILIKE '%dummy%'
   OR summary ILIKE '%diag%';

-- -----------------------------------------------------------------------------
-- 4. POST-MIGRATION RLS AUDIT ASSERTION
--    Verify every protected table has relrowsecurity = true.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_unprotected TEXT[];
BEGIN
  SELECT ARRAY_AGG(c.relname)
  INTO v_unprotected
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'jobs',
      'payouts',
      'disputes',
      'ratings',
      'dispute_messages',
      'compliance_documents',
      'contractor_agreements',
      'agent_events',
      'drivers_waitlist'
    )
    AND c.relrowsecurity = FALSE;

  IF v_unprotected IS NOT NULL AND array_length(v_unprotected, 1) > 0 THEN
    RAISE EXCEPTION 'Go-Live RLS Verification Failed: RLS not enabled on %', v_unprotected;
  END IF;
END $$;

COMMIT;
