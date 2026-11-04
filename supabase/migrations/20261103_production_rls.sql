-- =============================================================================
-- BEN LOGISTICS (MILTON KEYNES 2-MAN BULKY PLATFORM)
-- Production Schema & Strict Row-Level Security (RLS) Migration (Gate A)
-- Migration: 20261103_production_rls.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. SCHEMA ENHANCEMENTS & CORE TABLES
-- -----------------------------------------------------------------------------

-- 1.1 Admins Table
CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 Drivers Waitlist Table (Public Intake)
CREATE TABLE IF NOT EXISTS public.drivers_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Driver',
  vehicle_type TEXT NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  is_insured BOOLEAN NOT NULL DEFAULT FALSE,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 Jobs Table Enhancements
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pickup_address TEXT NOT NULL,
  drop_addresses TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Unassigned',
  vehicle_setup TEXT DEFAULT 'independent',
  loop_profile TEXT DEFAULT 'roc',
  gross_fee NUMERIC(10, 2) DEFAULT 440.00,
  platform_fee NUMERIC(10, 2) DEFAULT 55.00,
  net_pool NUMERIC(10, 2) DEFAULT 385.00,
  requires_tail_lift BOOLEAN NOT NULL DEFAULT FALSE,
  requires_assembly BOOLEAN NOT NULL DEFAULT FALSE,
  pod_image_url TEXT,
  signature_svg TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS retailer_id UUID,
  ADD COLUMN IF NOT EXISTS driver_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Unassigned',
  ADD COLUMN IF NOT EXISTS requires_tail_lift BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_assembly BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pod_image_url TEXT,
  ADD COLUMN IF NOT EXISTS signature_svg TEXT;

-- Ensure valid job statuses per pgTAP test suite & live app
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_status_valid_check'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_status_valid_check
      CHECK (status IN ('Unassigned', 'open', 'Assigned', 'assigned', 'In Progress', 'in_transit', 'Completed', 'delivered', 'cancelled'));
  END IF;
END $$;

-- 1.4 Payouts Table (pgTAP & Production Specification)
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_pence INTEGER NOT NULL DEFAULT 38500,
  platform_fee_pence INTEGER NOT NULL DEFAULT 5500,
  status TEXT NOT NULL DEFAULT 'pending',
  total_charged_to_retailer NUMERIC(10, 2),
  driver_payout NUMERIC(10, 2),
  payout_status TEXT DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount_pence INTEGER NOT NULL DEFAULT 38500,
  ADD COLUMN IF NOT EXISTS platform_fee_pence INTEGER NOT NULL DEFAULT 5500,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 1.5 Gate A6: Contractor Agreements Table (Outside-IR35 Audit Log)
CREATE TABLE IF NOT EXISTS public.contractor_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agreement_version TEXT NOT NULL DEFAULT 'v1.0-pilot-outside-ir35',
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  lead_driver_name TEXT NOT NULL,
  has_right_of_substitution BOOLEAN NOT NULL DEFAULT TRUE,
  confirms_git_and_pl BOOLEAN NOT NULL DEFAULT TRUE
);

-- 1.6 Compliance Documents Table (Uber-Style Compliance Locker)
CREATE TABLE IF NOT EXISTS public.compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('goods_in_transit', 'public_liability', 'hire_and_reward', 'driving_licence')),
  file_url TEXT NOT NULL,
  expiry_date DATE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Pending Verification',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.7 Agent Command Center Table
CREATE TABLE IF NOT EXISTS public.agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_meta TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. STRICT ROW-LEVEL SECURITY (RLS) LOCKDOWN
-- -----------------------------------------------------------------------------

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

-- Revoke overly permissive anon privileges across protected tables
REVOKE SELECT, UPDATE, DELETE ON public.drivers_waitlist FROM anon;
REVOKE ALL ON public.admins FROM anon;
REVOKE ALL ON public.jobs FROM anon;
REVOKE ALL ON public.payouts FROM anon;
REVOKE ALL ON public.contractor_agreements FROM anon;
REVOKE ALL ON public.compliance_documents FROM anon;
REVOKE ALL ON public.agent_events FROM anon;

GRANT INSERT ON public.drivers_waitlist TO anon, authenticated;

-- Drop any legacy permissive policies if present
DROP POLICY IF EXISTS "Allow public read and write on agent_events" ON public.agent_events;
DROP POLICY IF EXISTS "Public waitlist insert only" ON public.drivers_waitlist;
DROP POLICY IF EXISTS "Admins full access on drivers_waitlist" ON public.drivers_waitlist;
DROP POLICY IF EXISTS "Admins self read" ON public.admins;
DROP POLICY IF EXISTS "Retailers select own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Retailers insert own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Retailers update own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Crews select open or assigned jobs" ON public.jobs;
DROP POLICY IF EXISTS "Crews update assigned jobs" ON public.jobs;
DROP POLICY IF EXISTS "Crews select own payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins full access on payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins full access on agent_events" ON public.agent_events;
DROP POLICY IF EXISTS "Crews insert own contractor agreement" ON public.contractor_agreements;
DROP POLICY IF EXISTS "Crews select own contractor agreement" ON public.contractor_agreements;
DROP POLICY IF EXISTS "Crews insert own compliance docs" ON public.compliance_documents;
DROP POLICY IF EXISTS "Crews select own compliance docs" ON public.compliance_documents;
DROP POLICY IF EXISTS "Admins manage compliance docs" ON public.compliance_documents;

-- 2.1 `drivers_waitlist`: Anon can ONLY INSERT; Admins can read/manage
CREATE POLICY "Public waitlist insert only"
  ON public.drivers_waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins full access on drivers_waitlist"
  ON public.drivers_waitlist
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

-- 2.2 `admins`: Only admins can read the admin roster
CREATE POLICY "Admins self read"
  ON public.admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2.3 `jobs` RLS:
-- Retailers can SELECT, INSERT, UPDATE only rows where retailer_id = auth.uid()
CREATE POLICY "Retailers select own jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (retailer_id = auth.uid());

CREATE POLICY "Retailers insert own jobs"
  ON public.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (retailer_id = auth.uid());

CREATE POLICY "Retailers update own jobs"
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (retailer_id = auth.uid())
  WITH CHECK (retailer_id = auth.uid());

-- Crews can SELECT jobs where status IN ('open', 'Unassigned') OR driver_id = auth.uid()
CREATE POLICY "Crews select open or assigned jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    status IN ('open', 'Unassigned')
    OR driver_id = auth.uid()
  );

-- Crews can UPDATE (status, PoD, signature) only jobs where driver_id = auth.uid()
-- (or when claiming an unassigned/open job by setting driver_id = auth.uid())
CREATE POLICY "Crews update assigned jobs"
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid() OR status IN ('open', 'Unassigned'))
  WITH CHECK (driver_id = auth.uid());

-- 2.4 `payouts` RLS:
-- Crews can SELECT only where driver_id = auth.uid(). Retailers have zero read access.
CREATE POLICY "Crews select own payouts"
  ON public.payouts
  FOR SELECT
  TO authenticated
  USING (
    driver_id = auth.uid()
    AND COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), 'driver') <> 'retailer'
  );

CREATE POLICY "Admins full access on payouts"
  ON public.payouts
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

-- 2.5 `agent_events` RLS:
-- Restrict read/write strictly to users present in public.admins
CREATE POLICY "Admins full access on agent_events"
  ON public.agent_events
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

-- 2.6 `contractor_agreements` RLS:
CREATE POLICY "Crews insert own contractor agreement"
  ON public.contractor_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Crews select own contractor agreement"
  ON public.contractor_agreements
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
  );

-- 2.7 `compliance_documents` RLS:
CREATE POLICY "Crews insert own compliance docs"
  ON public.compliance_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Crews select own compliance docs"
  ON public.compliance_documents
  FOR SELECT
  TO authenticated
  USING (
    driver_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
  );

CREATE POLICY "Admins manage compliance docs"
  ON public.compliance_documents
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- 3. STORAGE BUCKETS & POLICIES (`pod-images` & `compliance-docs`)
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('pod-images', 'pod-images', false),
  ('compliance-docs', 'compliance-docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Crews upload PoD for assigned job" ON storage.objects;
DROP POLICY IF EXISTS "Crews and owning retailers read PoD images" ON storage.objects;
DROP POLICY IF EXISTS "Drivers upload own compliance docs" ON storage.objects;
DROP POLICY IF EXISTS "Drivers and admins read compliance docs" ON storage.objects;

-- 3.1 `pod-images`: Anon cannot list or read.
-- Crews can upload into paths matching their assigned job_id (`{job_id}/...`)
CREATE POLICY "Crews upload PoD for assigned job"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pod-images'
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[1]
        AND j.driver_id = auth.uid()
    )
  );

-- Retailers can only read photos for their owned jobs; assigned crew & admins can also read
CREATE POLICY "Crews and owning retailers read PoD images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pod-images'
    AND (
      EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id::text = (storage.foldername(name))[1]
          AND (j.retailer_id = auth.uid() OR j.driver_id = auth.uid())
      )
      OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
    )
  );

-- 3.2 `compliance-docs`: Only the owning driver (`{user_id}/...`) and admins can read/write
CREATE POLICY "Drivers upload own compliance docs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'compliance-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
    )
  );

CREATE POLICY "Drivers and admins read compliance docs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'compliance-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
    )
  );

COMMIT;
