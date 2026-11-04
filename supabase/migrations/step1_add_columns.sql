-- =============================================================================
-- STEP 1: Add missing columns without index or triggers
-- Run this block first!
-- =============================================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Unassigned',
  ADD COLUMN IF NOT EXISTS retailer_id UUID,
  ADD COLUMN IF NOT EXISTS driver_id UUID,
  ADD COLUMN IF NOT EXISTS requires_tail_lift BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_assembly BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_third_floor_no_lift BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS heavy_access_surcharge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pre_load_inspected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_drops_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exception_notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS job_id UUID,
  ADD COLUMN IF NOT EXISTS driver_id UUID,
  ADD COLUMN IF NOT EXISTS amount_pence INTEGER NOT NULL DEFAULT 38500,
  ADD COLUMN IF NOT EXISTS platform_fee_pence INTEGER NOT NULL DEFAULT 5500,
  ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
