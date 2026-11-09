-- =============================================================================
-- BEN LOGISTICS: PRE-PILOT PRODUCTION SECURITY & ATOMIC CLAIM HARDENING
-- Migration: 20261110_pre_pilot_security_lockdown.sql
-- =============================================================================

BEGIN;

-- 1. CREATE MISSING TABLES (ratings & dispute_messages)
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  rater_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rater_role TEXT NOT NULL CHECK (rater_role IN ('retailer', 'driver')),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID REFERENCES public.disputes(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('retailer', 'driver', 'admin')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- 2. REVOKE DANGEROUS ANON GRANTS FROM 20261104 MIGRATION
REVOKE ALL ON public.jobs FROM anon;
REVOKE ALL ON public.payouts FROM anon;
REVOKE ALL ON public.disputes FROM anon;
REVOKE ALL ON public.ratings FROM anon;
REVOKE ALL ON public.dispute_messages FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.drivers_waitlist FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payouts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.disputes TO authenticated;
GRANT SELECT, INSERT ON public.ratings TO authenticated;
GRANT SELECT, INSERT ON public.dispute_messages TO authenticated;

-- 3. DROP PERMISSIVE PILOT POLICIES FROM 20261104
DROP POLICY IF EXISTS "Pilot jobs read access" ON public.jobs;
DROP POLICY IF EXISTS "Pilot jobs insert access" ON public.jobs;
DROP POLICY IF EXISTS "Pilot jobs update access" ON public.jobs;
DROP POLICY IF EXISTS "Retailers insert payouts on job creation" ON public.payouts;
DROP POLICY IF EXISTS "Crews select own payouts" ON public.payouts;
DROP POLICY IF EXISTS "Authenticated users read disputes" ON public.disputes;
DROP POLICY IF EXISTS "Authenticated users insert disputes" ON public.disputes;

-- 4. HELPER FUNCTION: CHECK IF CREW IS FULLY VERIFIED & UNEXPIRED
CREATE OR REPLACE FUNCTION public.is_crew_compliant(p_driver_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    -- 1. Signed Gate A6 Outside-IR35 Agreement
    EXISTS (
      SELECT 1 FROM public.contractor_agreements ca
      WHERE ca.user_id = p_driver_id
        AND ca.agreement_version = 'v1.0-pilot-outside-ir35'
        AND ca.has_right_of_substitution = TRUE
        AND ca.confirms_git_and_pl = TRUE
    )
    -- 2. All 3 Mandatory Insurance Policies Verified & Unexpired
    AND (
      SELECT COUNT(DISTINCT cd.doc_type)
      FROM public.compliance_documents cd
      WHERE cd.driver_id = p_driver_id
        AND cd.doc_type IN ('goods_in_transit', 'public_liability', 'hire_and_reward')
        AND cd.verified = TRUE
        AND (cd.expiry_date IS NULL OR cd.expiry_date >= CURRENT_DATE)
    ) = 3;
$$;

-- 5. STRICT TENANT-ISOLATED RLS FOR `public.jobs`
DROP POLICY IF EXISTS "jobs_select_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_retailer_only" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_assigned_crew_or_owner" ON public.jobs;

CREATE POLICY "jobs_select_policy"
  ON public.jobs FOR SELECT TO authenticated
  USING (
    retailer_id = auth.uid()
    OR driver_id = auth.uid()
    OR (
      status IN ('Unassigned', 'open')
      AND COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', 'driver') = 'driver'
    )
    OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
  );

CREATE POLICY "jobs_insert_retailer_only"
  ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (
    retailer_id = auth.uid()
    AND status = 'Unassigned'
    AND driver_id IS NULL
  );

CREATE POLICY "jobs_update_assigned_crew_or_owner"
  ON public.jobs FOR UPDATE TO authenticated
  USING (
    -- Assigned driver updating their own active job
    driver_id = auth.uid()
    -- Or compliant driver claiming an unassigned job
    OR (driver_id IS NULL AND status IN ('Unassigned', 'open') AND public.is_crew_compliant(auth.uid()))
    -- Or owning retailer updating while still unassigned
    OR (retailer_id = auth.uid() AND status = 'Unassigned')
    OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
  )
  WITH CHECK (
    driver_id = auth.uid()
    OR (retailer_id = auth.uid() AND status = 'Unassigned')
    OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
  );

-- 6. ATOMIC ROUTE CLAIM RPC (PREVENTS RACE CONDITIONS & UPDATES PAYOUTS)
CREATE OR REPLACE FUNCTION public.claim_open_route(p_job_id UUID)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job public.jobs;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_crew_compliant(auth.uid()) THEN
    RAISE EXCEPTION 'Compliance Gate Blocked: Gate A6 signature and valid, unexpired GIT, Public Liability, and Hire & Reward certificates are required to claim routes.';
  END IF;

  UPDATE public.jobs
  SET
    driver_id = auth.uid(),
    status = 'Assigned'
  WHERE id = p_job_id
    AND status IN ('Unassigned', 'open')
    AND driver_id IS NULL
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Route #% has already been claimed by another crew.', p_job_id;
  END IF;

  UPDATE public.payouts
  SET driver_id = auth.uid()
  WHERE job_id::text = v_job.id::text;

  RETURN v_job;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_open_route(UUID) TO authenticated;

-- 7. STRICT RLS FOR `payouts`, `disputes`, `dispute_messages`, AND `ratings`
DROP POLICY IF EXISTS "payouts_select_crew_or_admin" ON public.payouts;
DROP POLICY IF EXISTS "payouts_insert_owning_retailer" ON public.payouts;
DROP POLICY IF EXISTS "disputes_select_participants" ON public.disputes;
DROP POLICY IF EXISTS "disputes_insert_participants" ON public.disputes;
DROP POLICY IF EXISTS "dispute_messages_access" ON public.dispute_messages;
DROP POLICY IF EXISTS "ratings_access" ON public.ratings;

CREATE POLICY "payouts_select_crew_or_admin"
  ON public.payouts FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = public.payouts.job_id::text AND j.retailer_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
  );

CREATE POLICY "payouts_insert_owning_retailer"
  ON public.payouts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = public.payouts.job_id::text AND j.retailer_id = auth.uid()
    )
  );

CREATE POLICY "disputes_select_participants"
  ON public.disputes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = public.disputes.job_id::text
        AND (j.retailer_id = auth.uid() OR j.driver_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
  );

CREATE POLICY "disputes_insert_participants"
  ON public.disputes FOR INSERT TO authenticated
  WITH CHECK (
    raised_by::text = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = public.disputes.job_id::text
        AND (j.retailer_id = auth.uid() OR j.driver_id = auth.uid())
    )
  );

CREATE POLICY "dispute_messages_access"
  ON public.dispute_messages FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.disputes d
      JOIN public.jobs j ON j.id::text = d.job_id::text
      WHERE d.id = public.dispute_messages.dispute_id
        AND (j.retailer_id = auth.uid() OR j.driver_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
  )
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "ratings_access"
  ON public.ratings FOR ALL TO authenticated
  USING (
    rater_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = public.ratings.job_id
        AND (j.retailer_id = auth.uid() OR j.driver_id = auth.uid())
    )
  )
  WITH CHECK (rater_id = auth.uid());

-- 8. STORAGE BUCKET MIME-TYPE, SIZE & UPSERT HARDENING
UPDATE storage.buckets
SET
  public = FALSE,
  file_size_limit = 10485760, -- 10 MB cap
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id IN ('pod-images', 'compliance-docs');

DROP POLICY IF EXISTS "Crews update PoD for assigned job" ON storage.objects;
CREATE POLICY "Crews update PoD for assigned job"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pod-images'
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[1]
        AND j.driver_id = auth.uid()
    )
  );

COMMIT;
