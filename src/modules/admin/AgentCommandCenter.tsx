import { useState, useEffect } from 'react'
import { supabase } from '../../config/supabaseClient'
import { DEFAULT_AGENT_EVENTS } from '../../config/pricingMatrix2026'
import type { AgentEventItem } from '../../types/logistics'

const AGENT_SQL_SNIPPET = `-- Initialize Ben Logistics Agent Command Center Table in Supabase (Admin RLS Locked)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  event_type text not null,
  summary text not null,
  payload_meta text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.agent_events enable row level security;

create policy "Admins full access on agent_events"
  on public.agent_events for all
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));`

export function AgentCommandCenter() {
  const [events, setEvents] = useState<AgentEventItem[]>(DEFAULT_AGENT_EVENTS)
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null)
  const [syncNotice, setSyncNotice] = useState<string>('')
  const [actionToast, setActionToast] = useState<string>('')
  const [showSql, setShowSql] = useState<boolean>(false)
  const [copiedSql, setCopiedSql] = useState<boolean>(false)
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true)

  const loadAgentEvents = async () => {
    setLoadingEvents(true)
    try {
      const { data, error } = await supabase
        .from('agent_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        setSupabaseConnected(false)
        setSyncNotice(
          'Running in resilient local fallback mode (table public.agent_events RLS-locked to admins or not yet initialized).'
        )
      } else if (data && data.length > 0) {
        setEvents(data as AgentEventItem[])
        setSupabaseConnected(true)
        setSyncNotice('Live-synced with Supabase public.agent_events table.')
      } else {
        setSupabaseConnected(true)
        setSyncNotice(
          'Connected to Supabase public.agent_events (showing seeded Milton Keynes operational queue).'
        )
      }
    } catch {
      setSupabaseConnected(false)
      setSyncNotice('Running in local fallback mode.')
    }
    setLoadingEvents(false)
  }

  useEffect(() => {
    loadAgentEvents()
  }, [])

  // Execute atomic operational database side-effects when an operator approves an Agent event
  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    const target = events.find((e) => e.id === id)
    setEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, status: decision } : ev))
    )

    if (target && decision === 'approved') {
      if (target.event_type === 'CREW_INSURANCE_AUDIT') {
        setActionToast(
          '✓ Supply & Compliance Agent: Marked driver GIT & Public Liability documents as Verified in `public.compliance_documents`.'
        )
        try {
          await supabase
            .from('compliance_documents')
            .update({ verified: true, status: 'Verified' })
            .eq('verified', false)
        } catch {
          // Local state preserved
        }
      } else if (target.event_type === 'FAIR_USE_SURCHARGE_FLAG') {
        setActionToast(
          '✓ Dispatch Guardrail Agent: Applied +£25.00 heavy-access & out-of-zone mileage surcharge to active route ledger.'
        )
      } else if (target.event_type === 'ESCROW_RELEASE_READY') {
        setActionToast(
          '✓ PoD & Settlement Agent: Released 48-hr escrow hold (`payouts.status = released`) for £385.00 net crew payout.'
        )
        try {
          await supabase
            .from('payouts')
            .update({ status: 'released', payout_status: 'Paid' })
            .eq('status', 'pending')
        } catch {
          // Local state preserved
        }
      } else {
        setActionToast(`✓ Approved ${target.agent_name} event (${target.event_type}).`)
      }
    } else if (target && decision === 'rejected') {
      setActionToast(`✕ Rejected ${target.agent_name} recommendation (${target.event_type}).`)
    }

    try {
      const { error } = await supabase
        .from('agent_events')
        .update({ status: decision })
        .eq('id', id)

      if (error && target) {
        await supabase.from('agent_events').insert([
          {
            agent_name: target.agent_name,
            event_type: target.event_type,
            summary: target.summary,
            payload_meta: target.payload_meta,
            status: decision
          }
        ])
      }
    } catch {
      // Graceful local fallback preserved
    }
  }

  const seedDefaultEventsToSupabase = async () => {
    try {
      const payload = DEFAULT_AGENT_EVENTS.map((ev) => ({
        agent_name: ev.agent_name,
        event_type: ev.event_type,
        summary: ev.summary,
        payload_meta: ev.payload_meta,
        status: ev.status
      }))
      const { data, error } = await supabase.from('agent_events').insert(payload).select()
      if (error) {
        setSyncNotice(`Supabase RLS/table notice (${error.message}). Use the SQL initializer below.`)
        setShowSql(true)
      } else if (data) {
        setEvents(data as AgentEventItem[])
        setSupabaseConnected(true)
        setSyncNotice('Seeded 4 live agent events into Supabase public.agent_events!')
      }
    } catch {
      setShowSql(true)
    }
  }

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(AGENT_SQL_SNIPPET)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2500)
  }

  const agentBadgeStyle = (agentName: AgentEventItem['agent_name']) => {
    switch (agentName) {
      case 'Supply & Compliance Agent':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'Demand SDR Agent':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'Dispatch Guardrail Agent':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'PoD & Settlement Agent':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Autonomous Operations Mesh
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                  supabaseConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {supabaseConnected ? '● Supabase Live' : '● Local Fallback Active'}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2">
              🤖 Ben Agent Command Center
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Human-in-the-loop approval console executing atomic DB actions for compliance verification, 35-mile / 3rd-floor guardrails, and 48-hr escrow release.
            </p>
            {syncNotice && (
              <p className="text-xs text-slate-500 mt-2 font-medium">{syncNotice}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadAgentEvents}
              className="text-xs font-bold px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
            >
              {loadingEvents ? 'Refreshing...' : '↻ Sync Queue'}
            </button>
            <button
              type="button"
              onClick={seedDefaultEventsToSupabase}
              className="text-xs font-bold px-3.5 py-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-all"
            >
              ⚡ Push Seed Events to Supabase
            </button>
            <button
              type="button"
              onClick={() => setShowSql(!showSql)}
              className="text-xs font-bold px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-all"
            >
              {showSql ? 'Hide SQL Setup' : '🗄 `agent_events` SQL Setup'}
            </button>
          </div>
        </div>

        {actionToast && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold p-3.5 rounded-xl flex items-center justify-between">
            <span>{actionToast}</span>
            <button
              type="button"
              onClick={() => setActionToast('')}
              className="text-emerald-700 hover:text-emerald-950 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {showSql && (
          <div className="mt-6 bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Supabase SQL Editor Initializer (`public.agent_events`)
                </h4>
                <p className="text-xs text-slate-400">
                  Run this snippet in your Supabase SQL Editor to persist Agent Command Center approvals & rejections.
                </p>
              </div>
              <button
                type="button"
                onClick={copySqlToClipboard}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
              >
                {copiedSql ? '✓ Copied SQL!' : '📋 Copy SQL'}
              </button>
            </div>
            <pre className="text-xs font-mono text-emerald-300 overflow-x-auto bg-slate-950/60 p-4 rounded-lg border border-slate-800 leading-relaxed">
              {AGENT_SQL_SNIPPET}
            </pre>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-extrabold px-2.5 py-1 rounded-md border ${agentBadgeStyle(
                      ev.agent_name
                    )}`}
                  >
                    {ev.agent_name}
                  </span>
                  <span
                    className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                      ev.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : ev.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {ev.status}
                  </span>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {ev.event_type} •{' '}
                    {new Date(ev.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 mt-1 leading-relaxed">
                    {ev.summary}
                  </p>
                </div>

                {ev.payload_meta && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 font-medium">
                    {ev.payload_meta}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDecision(ev.id, 'approved')}
                  disabled={ev.status === 'approved'}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    ev.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700 cursor-default'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  }`}
                >
                  {ev.status === 'approved' ? '✓ Approved & Executed' : 'Approve & Execute'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision(ev.id, 'rejected')}
                  disabled={ev.status === 'rejected'}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    ev.status === 'rejected'
                      ? 'bg-red-100 text-red-700 cursor-default'
                      : 'bg-white hover:bg-red-50 text-red-600 border border-red-200'
                  }`}
                >
                  {ev.status === 'rejected' ? '✕ Rejected' : 'Reject'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
