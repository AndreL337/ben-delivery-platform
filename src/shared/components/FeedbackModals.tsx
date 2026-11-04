import { useState, useEffect } from 'react'
import { supabase } from '../../config/supabaseClient'

export function RatingStars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange && onChange(n)}
          className={`text-2xl leading-none ${n <= value ? 'text-amber-400' : 'text-slate-200'} ${
            onChange ? 'hover:text-amber-400 cursor-pointer' : ''
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export function RateJobModal({
  job,
  userId,
  role,
  onClose
}: {
  job: any
  userId: string
  role: 'retailer' | 'driver'
  onClose: () => void
}) {
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (stars === 0) {
      setError('Please select a star rating.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('ratings').insert([
      {
        job_id: job.id,
        rater_id: userId,
        rater_role: role,
        stars,
        comment: comment.trim() || null
      }
    ])
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
        <h3 className="text-lg font-extrabold text-slate-900">Rate this job</h3>
        <p className="text-sm text-slate-500">{job.pickup_address}</p>
        <RatingStars value={stars} onChange={setStars} />
        <textarea
          placeholder="Optional comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm outline-none focus:border-emerald-500"
          rows={3}
        />
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-bold text-sm"
          >
            Skip
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
          >
            {submitting ? 'Saving...' : 'Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DisputePanel({
  job,
  userId,
  role,
  onClose
}: {
  job: any
  userId: string
  role: 'retailer' | 'driver'
  onClose: () => void
}) {
  const [dispute, setDispute] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [category, setCategory] = useState('other')
  const [description, setDescription] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data: existing } = await supabase
      .from('disputes')
      .select('*')
      .eq('job_id', job.id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (existing && existing.length > 0) {
      setDispute(existing[0])
      const { data: msgs } = await supabase
        .from('dispute_messages')
        .select('*')
        .eq('dispute_id', existing[0].id)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const raiseDispute = async () => {
    if (!description.trim()) return
    const formattedException = `[${category.toUpperCase()}] ${description.trim()}`

    try {
      // 1. Persist structured dispute/exception row in `public.disputes`
      const { data, error } = await supabase
        .from('disputes')
        .insert([
          {
            job_id: job.id,
            raised_by: userId,
            raised_by_role: role,
            category,
            description: description.trim(),
            status: 'awaiting_response'
          }
        ])
        .select()

      // 2. Also stamp `exception_notes` on `public.jobs` for instant manifest visibility
      await supabase
        .from('jobs')
        .update({ exception_notes: formattedException })
        .eq('id', job.id)

      if (!error && data && data[0]) {
        setDispute(data[0])
        setDescription('')
        load()
        return
      }
    } catch {
      // Fallback for offline / demo session
    }

    setDispute({
      id: `local-dispute-${Date.now()}`,
      job_id: job.id,
      category,
      description: description.trim(),
      status: 'awaiting_response'
    })
    setDescription('')
  }

  const sendReply = async () => {
    if (!reply.trim() || !dispute) return
    await supabase.from('dispute_messages').insert([
      {
        dispute_id: dispute.id,
        sender_id: userId,
        sender_role: role,
        message: reply.trim()
      }
    ])
    setReply('')
    load()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-extrabold text-slate-900">Report an issue (48-Hr SLA)</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-slate-500">{job.pickup_address}</p>

        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : !dispute ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Payouts are held for 48 hours post-PoD. Pre-existing depot damage must be photographed before loading. Verified transit/in-home damage is claimed against Crew GIT/PL insurance (crew excess capped at £250).
            </p>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm outline-none"
            >
              <option value="late">Late arrival</option>
              <option value="damage">In-transit / In-home Damage</option>
              <option value="customer_absent">Customer Not Home (10-min wait logged)</option>
              <option value="restricted_access">Restricted Stairwell / Doorway Fit Refusal</option>
              <option value="no_show">No show</option>
              <option value="payment">Payment / Surcharge issue</option>
              <option value="other">Other</option>
            </select>
            <textarea
              placeholder="Describe what happened (include pre-load or doorstep details)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm outline-none focus:border-emerald-500"
              rows={4}
            />
            <button
              onClick={raiseDispute}
              className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm"
            >
              Submit Report
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-500">
                {dispute.category.replace('_', ' ')}
              </span>
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-bold capitalize">
                {dispute.status.replace('_', ' ')}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
              {dispute.description}
            </div>
            <div className="space-y-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-lg text-sm ${
                    m.sender_id === userId
                      ? 'bg-emerald-50 border border-emerald-100 ml-6'
                      : 'bg-slate-50 border border-slate-200 mr-6'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                    {m.sender_role}
                  </div>
                  {m.message}
                </div>
              ))}
            </div>
            <div className="flex space-x-2 pt-2">
              <input
                placeholder="Add your response..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <button
                onClick={sendReply}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
