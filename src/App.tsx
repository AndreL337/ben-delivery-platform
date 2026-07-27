import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import './App.css'

const supabaseUrl = 'https://taqwjalqflxxuskschzc.supabase.co'
const supabaseAnonKey = 'sb_publishable_O6UTqJSmaEUl0ua23lh0zw_TUblF7U5'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Calibrated operational pricing matrix
const PRICING_MATRIX = {
  independent: {
    roc: { grossFee: 380, platformFee: 57, netPool: 323, targetVolume: "10-22 Stops" },
    assembly: { grossFee: 460, platformFee: 69, netPool: 391, targetVolume: "4-8 Stops" }
  },
  clientVehicle: {
    roc: { grossFee: 320, platformFee: 48, netPool: 272, targetVolume: "10-22 Stops" },
    assembly: { grossFee: 380, platformFee: 57, netPool: 323, targetVolume: "4-8 Stops" }
  }
};

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [roleMode, setRoleMode] = useState<'retailer' | 'driver'>('retailer')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [signupRole, setSignupRole] = useState<'driver' | 'retailer'>('driver')

  // Waitlist States
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Driver')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [isInsured, setIsInsured] = useState(false)

  // Interactive Live Run Matrix Calculator States
  const [vehicleSetup, setVehicleSetup] = useState<'independent' | 'clientVehicle'>('clientVehicle')
  const [loopProfile, setLoopProfile] = useState<'roc' | 'assembly'>('assembly')
  
  const currentTier = PRICING_MATRIX[vehicleSetup][loopProfile];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session);
      if (session?.user?.user_metadata?.role) {
        setRoleMode(session.user.user_metadata.role);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { 
      setSession(session);
      if (session?.user?.user_metadata?.role) {
        setRoleMode(session.user.user_metadata.role);
      }
    });

    return () => subscription.unsubscribe();
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    let logEmail = authEmail.trim();
    setAuthLoading(true)
    setAuthError('')

    if (authMode === 'signup') {
      if (authPassword.length < 8) {
        setAuthError('Password must be at least 8 characters.');
        setAuthLoading(false);
        return;
      }
      try {
        const { error } = await supabase.auth.signUp({
          email: logEmail,
          password: authPassword,
          options: { data: { role: signupRole } }
        });
        if (error) throw error;
        setRoleMode(signupRole);
      } catch (err: any) {
        setAuthError(err.message || 'Could not create account.');
      }
      setAuthLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: logEmail, password: authPassword })
      if (error) throw error

      const userRole = data.user?.user_metadata?.role; 
      if (userRole === 'driver') setRoleMode('driver');
      else if (userRole === 'retailer') setRoleMode('retailer');
      else setRoleMode('driver'); 
    } catch (err: any) { 
      setAuthError(err.message || 'Invalid login credentials.') 
    }
    setAuthLoading(false)
  }

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setWaitlistLoading(true)
    try {
      const regionalTerritoryTag = `Milton Keynes (${role})`;

      // Safely build the strictly required vehicle_type
      const calculatedVehicleType = make.trim() && model.trim() 
        ? `${make.trim()} ${model.trim()}` 
        : role === 'Porter' ? 'No Asset / Porter' : 'Standard Van';

      const { error } = await supabase.from('drivers_waitlist').insert([{ 
        full_name: driverName.trim(), 
        phone_number: driverPhone.trim(),
        email: email.trim(),
        role: role,
        vehicle_type: calculatedVehicleType, // <-- Satisfies the NOT NULL constraint perfectly
        vehicle_make: make.trim() || null,
        vehicle_model: model.trim() || null,
        vehicle_year: parseInt(year) || null, // <-- Safely sends null if empty instead of 0
        is_insured: isInsured,
        region: regionalTerritoryTag 
      }])
      
      if (error) throw error
      setWaitlistSubmitted(true)
      
      // Reset form
      setDriverName(''); setDriverPhone(''); setEmail(''); setRole('Driver'); 
      setMake(''); setModel(''); setYear(''); setIsInsured(false);
    } catch (err: any) { 
      alert(`Waitlist Sync Error: ${err.message}`) 
    }
    setWaitlistLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500/30">
      
      {/* 1. PREMIUM HEADER / TOP BAR - LIGHT MODE */}
      <header className="w-full bg-white/90 border-b border-slate-200 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex flex-row items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-wider text-slate-900 leading-none">
              BEN<span className="text-emerald-600 font-medium">LOGISTICS</span>
            </span>
            <span className="text-[10px] text-slate-500 tracking-widest uppercase font-bold mt-1">
              Milton Keynes Hub
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {!session ? (
            <button 
              onClick={() => setShowLogin(!showLogin)} 
              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold py-2 px-4 rounded-lg transition-all shadow-sm"
            >
              {showLogin ? '← Back to Fleet Page' : 'Operator Portal Login'}
            </button>
          ) : (
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500">Verified {roleMode}</p>
                <p className="text-sm font-bold text-emerald-600">Live & Connected</p>
              </div>
              <button 
                onClick={() => { 
                  supabase.auth.signOut(); 
                  setSession(null); 
                  setRoleMode('retailer'); 
                  setShowLogin(false);
                }} 
                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold py-2 px-4 rounded-lg transition-all"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. MAIN HUB CONTENT CONTAINER */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col space-y-10">
        
        {!session ? (
          showLogin ? (
            /* CONSOLE LOGIN VIEW */
            <div className="max-w-md mx-auto w-full">
              <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl shadow-slate-200/50">
                <form onSubmit={handleLogin} className="flex flex-col space-y-5">
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900">{authMode === 'signup' ? 'Create Your Account' : 'Operator Sign In'}</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {authMode === 'signup' ? 'Set up secure access to the Ben network.' : 'Sign in to your driver or retailer account.'}
                    </p>
                  </div>
                  
                  {authError && <p className="text-red-700 text-sm bg-red-50 p-3 rounded-lg border border-red-200">⚠️ {authError}</p>}
                  
                  <input 
                    type="text" 
                    placeholder="Email Address (or bypass keyword)" 
                    value={authEmail} 
                    onChange={(e) => setAuthEmail(e.target.value)} 
                    className="bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 rounded-lg py-3 px-4 outline-none transition-all"
                    required 
                  />
                  <input 
                    type="password" 
                    placeholder="Security Password" 
                    value={authPassword} 
                    onChange={(e) => setAuthPassword(e.target.value)} 
                    className="bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 rounded-lg py-3 px-4 outline-none transition-all"
                    required 
                  />
                  
                  {authMode === 'signup' && (
                    <div>
                      <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-2">I am a</label>
                      <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button type="button" onClick={() => setSignupRole('driver')} className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${signupRole === 'driver' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Driver / Porter</button>
                        <button type="button" onClick={() => setSignupRole('retailer')} className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${signupRole === 'retailer' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Retailer</button>
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={authLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-md shadow-emerald-600/20">
                    {authLoading ? 'Verifying...' : authMode === 'signup' ? 'Create Account →' : 'Authenticate Operator →'}
                  </button>

                  <p className="text-center text-xs text-slate-500">
                    {authMode === 'signup' ? 'Already have an account?' : "Don't have an account yet?"}{' '}
                    <button type="button" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthError(''); }} className="text-emerald-600 font-bold hover:underline">
                      {authMode === 'signup' ? 'Sign in' : 'Create one'}
                    </button>
                  </p>
                </form>
              </div>
            </div>
          ) : (
            /* LANDING PAGE VISUALS & SPLIT VIEW */
            <>
              {/* Hero Section */}
              <div className="space-y-4 max-w-2xl">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full">
                  Live Run Matrix Engine
                </span>
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl leading-tight">
                  Transparent Flat-Rate Daily Operations.
                </h1>
                <p className="text-slate-600 text-lg">
                  Completely eliminate volumetric spreadsheet drag. Adjust the operational parameters below to see the exact ledger allocations across the 2-man crew roster.
                </p>
              </div>

              {/* Two Column Layout for Calculator & Waitlist */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                
                {/* LEFT: Matrix Calculator */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col space-y-6">
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-2">Vehicle Assets Operational Setup</label>
                    <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button onClick={() => setVehicleSetup('clientVehicle')} className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${vehicleSetup === 'clientVehicle' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Client Vehicle</button>
                      <button onClick={() => setVehicleSetup('independent')} className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${vehicleSetup === 'independent' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Independent Van</button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-2">Route Manifest Classification</label>
                    <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button onClick={() => setLoopProfile('roc')} className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${loopProfile === 'roc' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Standard ROC</button>
                      <button onClick={() => setLoopProfile('assembly')} className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${loopProfile === 'assembly' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Delivery & Assembly</button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold uppercase text-slate-600">Target Route Capacity</span>
                    <span className="text-sm font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-md">{currentTier.targetVolume}</span>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between text-sm border-b border-slate-100 pb-2 text-slate-700">
                      <span className="font-semibold">Flat Route Booking Fee</span>
                      <span className="font-extrabold text-slate-900">£{currentTier.grossFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
                      <span>Ben Network Infrastructure Fee (15%)</span>
                      <span>- £{currentTier.platformFee.toFixed(2)}</span>
                    </div>
                    
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mt-2 text-left">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-xs font-bold uppercase text-emerald-800 block">Net Dispatched Labour Pool</span>
                          <p className="text-slate-600 text-[10px] mt-1 leading-relaxed max-w-[200px]">Total day rate allocated straight to the cab. Crew maintains full control to split payouts manually.</p>
                        </div>
                        <span className="text-3xl font-extrabold text-emerald-600">£{currentTier.netPool.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Waitlist Registration Form */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                  {waitlistSubmitted ? (
                    <div className="text-center py-10 space-y-4">
                      <span className="text-5xl">✅</span>
                      <h3 className="text-2xl font-extrabold text-slate-900">Entry Logged.</h3>
                      <p className="text-slate-600 text-sm leading-relaxed px-4">
                        We’ve received your professional credentials. You'll receive a confirmation email shortly. Keep your phone handy for a verification text.
                      </p>
                      <button onClick={() => setWaitlistSubmitted(false)} className="text-emerald-600 text-sm font-bold hover:underline mt-4">
                        Submit another crew member
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleWaitlistSubmit} className="flex flex-col space-y-4">
                      <div className="border-b border-slate-100 pb-4 mb-2">
                        <h3 className="text-xl font-extrabold text-slate-900">Join the MK Network</h3>
                        <p className="text-slate-500 text-sm mt-1">Register your profile to access the regional array.</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="Full Name" value={driverName} onChange={(e) => setDriverName(e.target.value)} required className="bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900 rounded-lg py-2.5 px-4 outline-none transition-all placeholder:text-slate-400" />
                        <input type="tel" placeholder="Mobile Number" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} required className="bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900 rounded-lg py-2.5 px-4 outline-none transition-all placeholder:text-slate-400" />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900 rounded-lg py-2.5 px-4 outline-none transition-all placeholder:text-slate-400" />
                        <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900 rounded-lg py-2.5 px-4 outline-none transition-all appearance-none">
                          <option value="Driver">Professional Driver</option>
                          <option value="Porter">Delivery Porter / Mate</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <input type="text" placeholder="Make" value={make} onChange={(e) => setMake(e.target.value)} className="col-span-1 bg-white border border-slate-300 focus:border-emerald-500 text-slate-900 rounded-lg py-2.5 px-3 outline-none text-sm placeholder:text-slate-400" />
                        <input type="text" placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} className="col-span-1 bg-white border border-slate-300 focus:border-emerald-500 text-slate-900 rounded-lg py-2.5 px-3 outline-none text-sm placeholder:text-slate-400" />
                        <input type="number" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} className="col-span-1 bg-white border border-slate-300 focus:border-emerald-500 text-slate-900 rounded-lg py-2.5 px-3 outline-none text-sm placeholder:text-slate-400" />
                      </div>

                      <label className="flex items-center gap-3 text-xs text-slate-600 cursor-pointer bg-slate-50 p-3 rounded-lg border border-slate-200 font-medium">
                        <input type="checkbox" checked={isInsured} onChange={(e) => setIsInsured(e.target.checked)} required className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 bg-white" />
                        I confirm I hold valid Goods in Transit insurance.
                      </label>

                      <button type="submit" disabled={waitlistLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-lg transition-all shadow-md shadow-emerald-600/20 mt-2">
                        {waitlistLoading ? 'Securing Allocation...' : 'Secure Route Allocation Spot →'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </>
          )
        ) : (
          /* SECURE BACKEND LOGISTICS DASHBOARD */
          <div className="max-w-2xl mx-auto w-full">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-lg">
              <div className="border-b border-slate-200 pb-4 mb-6">
                <h2 className="text-2xl font-extrabold text-slate-900 capitalize">
                  {roleMode} Workspace
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Secure encrypted connection to the Ben Milton Keynes delivery hub node.
                </p>
              </div>
              
              <BookJobForm retailerId={session.user.id} mode={roleMode} />
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="w-full py-6 border-t border-slate-200 text-center text-xs font-medium text-slate-500 bg-white mt-auto">
        &copy; 2026 Ben Logistics Hubs. All rights reserved.
      </footer>
    </div>
  )
}

function RatingStars({ value, onChange }: { value: number, onChange?: (n: number) => void }) {
  return (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange && onChange(n)}
          className={`text-2xl leading-none ${n <= value ? 'text-amber-400' : 'text-slate-200'} ${onChange ? 'hover:text-amber-400 cursor-pointer' : ''}`}
        >★</button>
      ))}
    </div>
  );
}

function RateJobModal({ job, userId, role, onClose }: { job: any, userId: string, role: 'retailer' | 'driver', onClose: () => void }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (stars === 0) { setError('Please select a star rating.'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('ratings').insert([{
      job_id: job.id, rater_id: userId, rater_role: role, stars, comment: comment.trim() || null
    }]);
    setSubmitting(false);
    if (error) { setError(error.message); return; }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
        <h3 className="text-lg font-extrabold text-slate-900">Rate this job</h3>
        <p className="text-sm text-slate-500">{job.pickup_address}</p>
        <RatingStars value={stars} onChange={setStars} />
        <textarea
          placeholder="Optional comment"
          value={comment}
          onChange={e => setComment(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm outline-none focus:border-emerald-500"
          rows={3}
        />
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <div className="flex space-x-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-bold text-sm">Skip</button>
          <button onClick={submit} disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm">
            {submitting ? 'Saving...' : 'Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DisputePanel({ job, userId, role, onClose }: { job: any, userId: string, role: 'retailer' | 'driver', onClose: () => void }) {
  const [dispute, setDispute] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: existing } = await supabase.from('disputes').select('*').eq('job_id', job.id).order('created_at', { ascending: false }).limit(1);
    if (existing && existing.length > 0) {
      setDispute(existing[0]);
      const { data: msgs } = await supabase.from('dispute_messages').select('*').eq('dispute_id', existing[0].id).order('created_at', { ascending: true });
      setMessages(msgs || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const raiseDispute = async () => {
    if (!description.trim()) return;
    const { data, error } = await supabase.from('disputes').insert([{
      job_id: job.id, raised_by: userId, raised_by_role: role, category, description: description.trim(), status: 'awaiting_response'
    }]).select();
    if (!error && data) { setDispute(data[0]); setDescription(''); load(); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !dispute) return;
    await supabase.from('dispute_messages').insert([{ dispute_id: dispute.id, sender_id: userId, sender_role: role, message: reply.trim() }]);
    setReply('');
    load();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-extrabold text-slate-900">Report an issue</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
        </div>
        <p className="text-sm text-slate-500">{job.pickup_address}</p>

        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : !dispute ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">The other party will be able to respond before anything happens to either account — nothing is decided on one report alone.</p>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm outline-none">
              <option value="late">Late arrival</option>
              <option value="damage">Damage</option>
              <option value="no_show">No show</option>
              <option value="payment">Payment issue</option>
              <option value="behaviour">Behaviour / conduct</option>
              <option value="other">Other</option>
            </select>
            <textarea
              placeholder="Describe what happened"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm outline-none focus:border-emerald-500"
              rows={4}
            />
            <button onClick={raiseDispute} className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm">Submit Report</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-500">{dispute.category.replace('_', ' ')}</span>
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-bold capitalize">{dispute.status.replace('_', ' ')}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">{dispute.description}</div>
            <div className="space-y-2">
              {messages.map(m => (
                <div key={m.id} className={`p-3 rounded-lg text-sm ${m.sender_id === userId ? 'bg-emerald-50 border border-emerald-100 ml-6' : 'bg-slate-50 border border-slate-200 mr-6'}`}>
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">{m.sender_role}</div>
                  {m.message}
                </div>
              ))}
            </div>
            <div className="flex space-x-2 pt-2">
              <input
                placeholder="Add your response..."
                value={reply}
                onChange={e => setReply(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <button onClick={sendReply} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold">Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BookJobForm({ retailerId, mode }: { retailerId: string, mode: 'retailer' | 'driver' }) {
  const [jobData, setJobData] = useState({ vehicle_setup: 'clientVehicle', loop_profile: 'assembly', pickup_address: '', drop_addresses: '' })
  const [activeJobs, setActiveJobs] = useState<any[]>([])
  const [complianceAccepted, setComplianceAccepted] = useState(false)
  const [retailerTab, setRetailerTab] = useState<'book' | 'track' | 'ledger'>('book')
  const [ratingJob, setRatingJob] = useState<any>(null)
  const [disputeJob, setDisputeJob] = useState<any>(null)

  const fetchLogisticsData = async () => {
    const { data: jobs } = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
    if (jobs) setActiveJobs(jobs)
  }

  const uploadPoD = async (jobId: string, file: File) => {
    const { data: uploadData } = await supabase.storage
      .from('pod-images')
      .upload(`${jobId}/${Date.now()}.jpg`, file);
    
    if (uploadData) {
      await supabase.from('jobs').update({ status: 'Completed' }).eq('id', jobId);
      const { data: updatedJobs } = await supabase.from('jobs').select('*').eq('id', jobId);
      if (updatedJobs && updatedJobs[0]) setRatingJob(updatedJobs[0]);
      fetchLogisticsData();
    }
  };

  useEffect(() => {
    fetchLogisticsData();
    const interval = setInterval(fetchLogisticsData, 3000);
    return () => clearInterval(interval);
  }, []);

  const exportLedgerToCSV = () => {
    const completedJobs = activeJobs.filter(j => j.status === 'Completed');
    const headers = ["Date", "Pickup Address", "Gross Fare (£)", "Agency Commission (£)"];
    const csvRows = completedJobs.map(job => {
      const date = new Date(job.created_at).toLocaleDateString();
      return [date, `"${job.pickup_address}"`, job.gross_fee ?? 380, job.platform_fee ?? 57].join(",");
    });
    const csvString = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Ben_Agency_Ledger_${new Date().toLocaleDateString()}.csv`);
    a.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tier = PRICING_MATRIX[jobData.vehicle_setup as 'independent' | 'clientVehicle'][jobData.loop_profile as 'roc' | 'assembly'];
    const { data } = await supabase.from('jobs').insert([{
      retailer_id: retailerId,
      pickup_address: jobData.pickup_address,
      drop_addresses: jobData.drop_addresses,
      status: 'Unassigned',
      vehicle_setup: jobData.vehicle_setup,
      loop_profile: jobData.loop_profile,
      gross_fee: tier.grossFee,
      platform_fee: tier.platformFee,
      net_pool: tier.netPool
    }]).select();
    if (data) {
      await supabase.from('payouts').insert([{ job_id: data[0].id, total_charged_to_retailer: tier.grossFee, driver_payout: tier.netPool, payout_status: 'Pending' }]);
      fetchLogisticsData();
    }
  }

  const parseDrops = (job: any) => job.drop_addresses ? job.drop_addresses.split(',').map((a: string) => a.trim()) : [];
  const activeDriverJob = activeJobs.find(job => job.status === 'Assigned' || job.status === 'In Progress');

  return (
    <div className="w-full">
      {mode === 'retailer' ? (
        <div>
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 mb-6">
            <button onClick={() => setRetailerTab('book')} className={`py-2 text-sm font-bold rounded-lg transition-all ${retailerTab === 'book' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>📝 Book</button>
            <button onClick={() => setRetailerTab('track')} className={`py-2 text-sm font-bold rounded-lg transition-all ${retailerTab === 'track' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>📡 Track</button>
            <button onClick={() => setRetailerTab('ledger')} className={`py-2 text-sm font-bold rounded-lg transition-all ${retailerTab === 'ledger' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>💰 Ledger</button>
          </div>
          
          {retailerTab === 'book' && (
             <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                <input placeholder="Pickup Address" onChange={e => setJobData({...jobData, pickup_address: e.target.value})} required className="bg-white border border-slate-300 focus:border-emerald-500 text-slate-900 rounded-lg py-3 px-4 outline-none placeholder:text-slate-400" />
                <input placeholder="Drop Addresses (comma separated)" onChange={e => setJobData({...jobData, drop_addresses: e.target.value})} required className="bg-white border border-slate-300 focus:border-emerald-500 text-slate-900 rounded-lg py-3 px-4 outline-none placeholder:text-slate-400" />
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-lg transition-all shadow-md mt-2">Launch Route Array →</button>
             </form>
          )}
          
          {retailerTab === 'track' && (
            <div className="space-y-3">
              {activeJobs.filter(j => j.retailer_id === retailerId).map(j => (
                <div key={j.id} className="p-4 bg-white border border-slate-200 rounded-xl flex justify-between items-center shadow-sm">
                  <span className="text-slate-900 font-bold">{j.pickup_address}</span>
                  <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-md font-bold">{j.status}</span>
                </div>
              ))}
            </div>
          )}
          
          {retailerTab === 'ledger' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Agency Settlement</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cumulative Commission: 
                    <span className="font-bold text-emerald-600 ml-2">
                      £{activeJobs.filter(j => j.status === 'Completed').reduce((sum, j) => sum + (j.platform_fee ?? 57), 0)}
                    </span>
                  </p>
                </div>
                <button onClick={exportLedgerToCSV} className="text-xs font-bold px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 transition-all">⬇ Export CSV</button>
              </div>
              <div className="flex flex-col space-y-3">
                {activeJobs.filter(j => j.status === 'Completed').map(job => (
                  <div key={job.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{job.pickup_address}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{new Date(job.created_at).toLocaleDateString()}</div>
                      <div className="flex space-x-3 mt-1.5">
                        <button onClick={() => setRatingJob(job)} className="text-[10px] font-bold text-emerald-600 hover:underline">★ Rate</button>
                        <button onClick={() => setDisputeJob(job)} className="text-[10px] font-bold text-red-500 hover:underline">⚠ Report Issue</button>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-emerald-600">+£{(job.platform_fee ?? 57).toFixed(2)}</div>
                      <div className="text-[9px] uppercase font-bold text-slate-400">Comm. Earned</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : mode === 'driver' && !complianceAccepted ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="text-red-700 text-lg font-bold mb-4 flex items-center">⚠️ Independent Contractor Agreement</h3>
          <div className="text-sm text-slate-700 space-y-3 mb-6">
            <p className="font-medium">By proceeding, you confirm the following:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>You are a self-employed business entity.</li>
              <li>You are responsible for your own tax and NI contributions.</li>
              <li>You provide your own insurance and vehicle assets.</li>
              <li>This platform acts as an agent; you are not an employee of Ben Logistics.</li>
            </ul>
            <label className="flex items-center gap-3 mt-4 cursor-pointer p-3 bg-white rounded-lg border border-red-100 shadow-sm">
              <input type="checkbox" onChange={(e) => setComplianceAccepted(e.target.checked)} className="w-5 h-5 rounded border-slate-300 bg-white text-emerald-600 focus:ring-0" />
              <span className="font-bold text-slate-900">I agree to the terms.</span>
            </label>
          </div>
          <button 
            disabled={!complianceAccepted} 
            onClick={() => setComplianceAccepted(true)} 
            className={`w-full py-3.5 rounded-lg font-bold transition-all ${complianceAccepted ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            Initialize Secure Driver Portal
          </button>
        </div>
      ) : (
        <div className="w-full">
          {activeDriverJob ? (
            <div className="bg-white border border-emerald-200 p-6 rounded-xl relative overflow-hidden shadow-md">
              <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-1">📍 Active Loop: {activeDriverJob.pickup_address}</h3>
              <p className="text-xs font-bold text-emerald-700 mb-4 bg-emerald-50 inline-block px-2 py-1 rounded border border-emerald-100">Status: {activeDriverJob.status}</p>
              
              <div className="space-y-2 mt-2">
                {parseDrops(activeDriverJob).map((d: string, i: number) => (
                  <div key={i} className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center font-medium">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs flex items-center justify-center mr-3 font-bold">{i+1}</span>
                    {d}
                  </div>
                ))}
              </div>
              
              <div className="mt-4">
                <button onClick={() => setDisputeJob(activeDriverJob)} className="text-xs font-bold text-red-500 hover:underline">⚠ Report an issue with this job</button>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <label className="block cursor-pointer bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg text-center font-bold transition-all shadow-md shadow-blue-600/20">
                  📷 Upload Proof of Delivery
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        uploadPoD(activeDriverJob.id, e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-4 border-b border-slate-200 pb-2">Open Freight Board</h3>
              <div className="space-y-3">
                {activeJobs.filter(j => j.status === 'Unassigned').map(j => (
                  <div key={j.id} className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
                    <div>
                      <span className="font-bold text-slate-800 block">{j.pickup_address}</span>
                      <span className="text-xs font-bold text-emerald-700">You earn: £{(j.net_pool ?? 323).toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={() => supabase.from('jobs').update({ status: 'Assigned' }).eq('id', j.id).then(fetchLogisticsData)} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition-all shadow-sm"
                    >
                      Claim Route
                    </button>
                  </div>
                ))}
                {activeJobs.filter(j => j.status === 'Unassigned').length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-6 font-medium bg-slate-50 rounded-xl border border-slate-200">No unassigned routes currently available.</p>
                )}
              </div>
            </div>
          )}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Ben Logistics Node • Independent Status Active
            </p>
          </div>
        </div>
      )}

      {ratingJob && (
        <RateJobModal job={ratingJob} userId={retailerId} role={mode} onClose={() => setRatingJob(null)} />
      )}
      {disputeJob && (
        <DisputePanel job={disputeJob} userId={retailerId} role={mode} onClose={() => setDisputeJob(null)} />
      )}
    </div>  
  )
}