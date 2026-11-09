-- =============================================================================
-- BEN LOGISTICS: DRIVER-FIRST ROUTING ENGINE & CREW BLACK-BOOK SCHEMA
-- Migration: 20261111_driver_first_routing_engine.sql
-- =============================================================================

BEGIN;

-- 1. Extend `public.jobs` with non-breaking routing & LIFO columns
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS routing_mode TEXT NOT NULL DEFAULT 'tightest_loop'
    CHECK (routing_mode IN ('clear_bulk_first', 'out_and_back', 'tightest_loop')),
  ADD COLUMN IF NOT EXISTS route_inverted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS driver_home_postcode TEXT DEFAULT 'MK9',
  ADD COLUMN IF NOT EXISTS ordered_manifest_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lifo_load_plan_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS load_plan_locked_at TIMESTAMPTZ;

-- 2. Create `public.location_blackbook` (Street-Sense Filter & Postcode Hazards)
CREATE TABLE IF NOT EXISTS public.location_blackbook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode_key TEXT NOT NULL, -- Normalized outcode or full postcode (e.g. 'MK9 2EA' or 'MK9')
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  hazard_type TEXT NOT NULL CHECK (
    hazard_type IN ('school_run', 'commercial_shutter', 'low_bridge', 'tight_turning', 'loading_bay_code', 'stairs_hazard')
  ),
  hazard_note TEXT NOT NULL,
  avoid_window_start TIME, -- e.g. '08:15' for school run shield
  avoid_window_end TIME,   -- e.g. '09:15'
  shutter_close_time TIME, -- e.g. '16:30' commercial dock cutoff
  verified_upvotes INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blackbook_postcode_key ON public.location_blackbook(postcode_key);

ALTER TABLE public.location_blackbook ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated crews read blackbook" ON public.location_blackbook;
DROP POLICY IF EXISTS "Authenticated crews insert blackbook notes" ON public.location_blackbook;

CREATE POLICY "Authenticated crews read blackbook"
  ON public.location_blackbook FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated crews insert blackbook notes"
  ON public.location_blackbook FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

COMMIT;
