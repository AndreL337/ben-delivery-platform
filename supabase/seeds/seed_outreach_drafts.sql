-- Seed 5 Hub 01 Showroom Outreach Gmail Drafts into public.agent_events
-- Operator Audit Queue: /command (AgentCommandCenter)
-- Schema matches supabase/migrations/20261103_production_rls.sql (`public.agent_events`)
-- Note: `status = 'pending'` surfaces these events for 1-click Approve / Reject in /command.

BEGIN;

INSERT INTO public.agent_events (
  agent_name,
  event_type,
  summary,
  payload_meta,
  status
)
VALUES
  (
    'Demand SDR',
    'OUTREACH_GMAIL_DRAFT',
    'Draft #1 Ready: Hatters Home & Style (Bedford MK42) — Overflow & Friday Rescue Backup (£145 Rescue / £440 ROC | Pay-on-Success Pilot)',
    '{"draft_id":"draft-1","prospect":"Hatters Home & Style","location":"Bedford (St Johns St / MK42)","from":"andre@benlogistics.co.uk","subject":"Overflow & Friday rescue 2-man cover for Hatters Home & Style — £0 if we fail","rate_card":"https://www.benlogistics.co.uk/rate-card","target_tier":"£145 Rescue / £440 ROC","requires_approval":true,"approval_status":"pending","draft_ref":"docs/outreach/RETAILER_GMAIL_DRAFTS.md#draft-1"}',
    'pending'
  ),
  (
    'Demand SDR',
    'OUTREACH_GMAIL_DRAFT',
    'Draft #2 Ready: Age UK Milton Keynes Furniture Showroom (Kiln Farm MK11) — Overflow & Friday Rescue Backup (£145 Rescue / £440 ROC | Pay-on-Success Pilot)',
    '{"draft_id":"draft-2","prospect":"Age UK Milton Keynes Furniture Showroom","location":"Kiln Farm, Milton Keynes (Burners Lane, MK11)","from":"andre@benlogistics.co.uk","subject":"Kiln Farm overflow & Friday rescue 2-man van cover (£145 flat / Pay-on-Success)","rate_card":"https://www.benlogistics.co.uk/rate-card","target_tier":"£145 Rescue / £440 ROC","requires_approval":true,"approval_status":"pending","draft_ref":"docs/outreach/RETAILER_GMAIL_DRAFTS.md#draft-2"}',
    'pending'
  ),
  (
    'Demand SDR',
    'OUTREACH_GMAIL_DRAFT',
    'Draft #3 Ready: HSL Chairs & Beds Milton Keynes (Stacey Bushes MK12) — Gentle 2-Man Overflow & Assembly Backup (£145 Rescue / £520 Assembly | Pay-on-Success Pilot)',
    '{"draft_id":"draft-3","prospect":"HSL Chairs & Beds (Milton Keynes)","location":"Stacey Bushes Trading Centre (Erica Rd, MK12)","from":"andre@benlogistics.co.uk","subject":"Gentle 2-man overflow & assembly backup for HSL Milton Keynes (Pay-on-Success)","rate_card":"https://www.benlogistics.co.uk/rate-card","target_tier":"£145 Rescue / £520 Assembly","requires_approval":true,"approval_status":"pending","draft_ref":"docs/outreach/RETAILER_GMAIL_DRAFTS.md#draft-3"}',
    'pending'
  ),
  (
    'Demand SDR',
    'OUTREACH_GMAIL_DRAFT',
    'Draft #4 Ready: Bell of Northampton (Kingsthorpe Rd NN2) — Overflow & Friday Rescue KBB Cover (£145 Rescue / £440 ROC | Pay-on-Success Pilot)',
    '{"draft_id":"draft-4","prospect":"Bell of Northampton","location":"Kingsthorpe Rd, Northampton (NN2)","from":"andre@benlogistics.co.uk","subject":"Overflow & Friday rescue 2-man KBB cover for Bell of Northampton (£0 if we fail)","rate_card":"https://www.benlogistics.co.uk/rate-card","target_tier":"£145 Rescue / £440 ROC","requires_approval":true,"approval_status":"pending","draft_ref":"docs/outreach/RETAILER_GMAIL_DRAFTS.md#draft-4"}',
    'pending'
  ),
  (
    'Demand SDR',
    'OUTREACH_GMAIL_DRAFT',
    'Draft #5 Ready: The Home Styling Company (Hub 01) — On-Demand 2-Man Assembly & Friday Rescue Crew (£145 Rescue / £520 Assembly | Pay-on-Success Pilot)',
    '{"draft_id":"draft-5","prospect":"The Home Styling Company","location":"Milton Keynes, Northants, Beds & Oxon","from":"andre@benlogistics.co.uk","subject":"On-demand 2-man assembly & Friday rescue crew for The Home Styling Company","rate_card":"https://www.benlogistics.co.uk/rate-card","target_tier":"£145 Rescue / £520 Assembly / £410 Pod","requires_approval":true,"approval_status":"pending","draft_ref":"docs/outreach/RETAILER_GMAIL_DRAFTS.md#draft-5"}',
    'pending'
  );

COMMIT;
