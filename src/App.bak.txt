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

  // Waitlist States (Restored and Expanded)
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
    // Check role on initial load
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session);
      if (session?.user?.user_metadata?.role) {
        setRoleMode(session.user.user_metadata.role);
      }
    });

    // Check role any time the auth state changes (like when provisioning)
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

    // 🚀 FAST-TRACK DEBUG OVERRIDE: Log in instantly without real credentials
    if (authEmail.trim().toLowerCase() === 'driver') {
      setRoleMode('driver');
      setSession({ user: { id: 'debug-driver-id' } });
      return;
    }
    if (authEmail.trim().toLowerCase() === 'retailer') {
      setRoleMode('retailer');
      setSession({ user: { id: 'debug-retailer-id' } });
      return;
    }

    let logEmail = authEmail.trim();
    setAuthLoading(true)
    setAuthError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: logEmail, password: authPassword })
      if (error) throw error

      // Extract the assigned role from the Supabase auth user metadata profile
      const userRole = data.user?.user_metadata?.role; 
      
      if (userRole === 'driver') {
        setRoleMode('driver');
      } else if (userRole === 'retailer') {
        setRoleMode('retailer');
      } else {
        // Fallback safety gate
        setRoleMode('driver'); 
      }
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

      const { error } = await supabase.from('driver_waitlist').insert([{ 
        full_name: driverName.trim(), 
        phone_number: driverPhone.trim(),
        email: email.trim(),
        role: role,
        vehicle_make: make,
        vehicle_model: model,
        vehicle_year: parseInt(year) || 0,
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
    <div className="landing-container">
      
      {/* 1. FLOATING PILL NAVBAR */}
      <div className="navbar-pill">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: '#76bd43', color: 'white', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>B</div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>Ben</span>
        </div>
        
        <div className="nav-links">
          <a href="#services">Services</a>
          <a href="#cases">Case Studies</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>

        <div>
          {!session ? (
            <button onClick={() => setShowLogin(!showLogin)} className="btn-green">
              {showLogin ? '← Fleet Page' : 'Operator Portal'}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: '#111827', color: 'white', padding: '6px 12px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Verified {roleMode}
              </span>
              <button 
                onClick={() => { 
                  supabase.auth.signOut(); 
                  setSession(null); 
                  setRoleMode('retailer'); 
                  setShowLogin(false);
                }} 
                className="btn-green" 
                style={{ background: '#E74C3C', padding: '8px 16px' }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. DYNAMIC WORKSPACE GATEWAY */}
      {!session ? (
        showLogin ? (
          /* CONSOLE LOGIN VIEW */
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <form onSubmit={handleLogin} className="form-panel" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Operator Sign In</h2>
              {authError && <p style={{ color: 'red', margin: 0 }}>⚠️ {authError}</p>}
              
              <p style={{ fontSize: 11, color: '#666', margin: '-8px 0 8px 0' }}>💡 Pro Tip: Type <strong>driver</strong> or <strong>retailer</strong> in the email field to bypass.</p>

              <input type="text" placeholder="Email Address (or type 'driver')" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
              <input type="password" placeholder="Security Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required />
              <button type="submit" disabled={authLoading} className="btn-green" style={{ width: '100%', padding: 16, fontSize: 16 }}>
                {authLoading ? 'Verifying...' : 'Authenticate Operator →'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#cbd5e1' }}></div>
                <span style={{ padding: '0 12px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sandbox Environment Provisioners</span>
                <div style={{ flex: 1, height: 1, background: '#cbd5e1' }}></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button type="button" className="btn-white" style={{ fontSize: 11, padding: '10px 4px', border: '1px solid #cbd5e1', borderRadius: 12, background: 'white' }}
                  onClick={async () => {
                    setAuthLoading(true);
                    const email = `driver_${Math.floor(Math.random() * 10000)}@benlogistics.co.uk`;
                    const { error } = await supabase.auth.signUp({ email, password: 'Password123!', options: { data: { role: 'driver' } } });
                    if (error) alert(`Provisioning failed: ${error.message}`);
                    else alert(`Driver Created Successfully!\nEmail: ${email}\nPassword: Password123!`);
                    setAuthLoading(false);
                  }}>🛠️ Provision Test Driver</button>

                <button type="button" className="btn-white" style={{ fontSize: 11, padding: '10px 4px', border: '1px solid #cbd5e1', borderRadius: 12, background: 'white' }}
                  onClick={async () => {
                    setAuthLoading(true);
                    const email = `retailer_${Math.floor(Math.random() * 10000)}@benlogistics.co.uk`;
                    const { error } = await supabase.auth.signUp({ email, password: 'Password123!', options: { data: { role: 'retailer' } } });
                    if (error) alert(`Provisioning failed: ${error.message}`);
                    else alert(`Retailer Created Successfully!\nEmail: ${email}\nPassword: Password123!`);
                    setAuthLoading(false);
                  }}>🏬 Provision Test Retailer</button>
              </div>
            </form>
          </div>
        ) : (
          /* LANDING PAGE VISUALS */
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 48, textAlign: 'left', alignItems: 'start' }}>
            
            <div>
              <span style={{ background: 'white', padding: '6px 16px', borderRadius: 50, fontSize: 12, fontWeight: 700, color: '#444', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                Live Run Matrix Engine
              </span>
              <h2 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-1.5px', color: '#111', marginTop: 24, marginBottom: 0, lineHeight: 1.1 }}>
                Transparent Flat-Rate Daily Operations
              </h2>
              <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.5, marginTop: 12, marginBottom: 24, fontWeight: 500 }}>
                Completely eliminate volumetric spreadsheet drag. Adjust the operational parameters below to see the exact ledger allocations across the 2-man crew roster.
              </p>

              <div className="form-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16, background: 'rgba(255,255,255,0.6)', padding: 20, borderRadius: 16, border: '1px solid rgba(0,0,0,0.05)', marginBottom: 24 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#666', letterSpacing: '1px', display: 'block', marginBottom: 6 }}>Vehicle Assets Operational Setup</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#e2e8f0', padding: 3, borderRadius: 30 }}>
                    <button type="button" onClick={() => setVehicleSetup('clientVehicle')} style={{ padding: '8px 12px', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: vehicleSetup === 'clientVehicle' ? '#111' : 'transparent', color: vehicleSetup === 'clientVehicle' ? 'white' : '#555' }}>Client Vehicle</button>
                    <button type="button" onClick={() => setVehicleSetup('independent')} style={{ padding: '8px 12px', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: vehicleSetup === 'independent' ? '#111' : 'transparent', color: vehicleSetup === 'independent' ? 'white' : '#555' }}>Independent Van</button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#666', letterSpacing: '1px', display: 'block', marginBottom: 6 }}>Route Manifest Classification</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#e2e8f0', padding: 3, borderRadius: 30 }}>
                    <button type="button" onClick={() => setLoopProfile('roc')} style={{ padding: '8px 12px', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: loopProfile === 'roc' ? '#76bd43' : 'transparent', color: loopProfile === 'roc' ? 'white' : '#555' }}>Standard ROC</button>
                    <button type="button" onClick={() => setLoopProfile('assembly')} style={{ padding: '8px 12px', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: loopProfile === 'assembly' ? '#76bd43' : 'transparent', color: loopProfile === 'assembly' ? 'white' : '#555' }}>Delivery & Assembly</button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>Target Route Capacity</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#111', background: '#FAFCEF', border: '1px solid #E8F5C8', padding: '4px 10px', borderRadius: 6 }}>{currentTier.targetVolume}</span>
                </div>

                <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #f5f5f5', paddingBottom: 6 }}>
                    <span style={{ color: '#666', fontWeight: 500 }}>Flat Route Booking Fee</span>
                    <span style={{ fontWeight: 800 }}>£{currentTier.grossFee.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', borderBottom: '1px solid #f5f5f5', paddingBottom: 6 }}>
                    <span>Ben Network Infrastructure Fee (15%)</span>
                    <span>- £{currentTier.platformFee.toFixed(2)}</span>
                  </div>
                  
                  <div style={{ background: '#FAFCEF', border: '1px solid #E8F5C8', padding: '14px 16px', borderRadius: 12, marginTop: 4, textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#4D7C0F', display: 'block' }}>Net Dispatched Labour Pool</span>
                        <p style={{ color: '#555', fontSize: 11, margin: '2px 0 0 0', lineHeight: 1.3 }}>Total day rate allocated straight to the cab. Crew maintains full control to split payouts manually or apply standard 60/40 distributions before route dispatch.</p>
                      </div>
                      <span style={{ color: '#76bd43', fontSize: '1.8rem', fontWeight: 900, paddingLeft: 12 }}>£{currentTier.netPool.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-panel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {waitlistSubmitted ? (
              <div style={{ textAlign: 'center', padding: '40px 0', background: 'white', borderRadius: 16, border: '1px solid #eee' }}>
                <span style={{ fontSize: 48 }}>✅</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: 16 }}>Entry Logged. Welcome to Ben.</h3>
                <p style={{ color: '#555', fontSize: 14, padding: '0 20px', lineHeight: 1.6 }}>
                  We’ve received your professional credentials. You'll receive a confirmation email shortly. 
                  We are currently onboarding MK crews—keep your phone handy for a verification text.
                </p>
                <button onClick={() => setWaitlistSubmitted(false)} style={{ marginTop: 20, background: 'none', border: 'none', color: '#666', textDecoration: 'underline', cursor: 'pointer' }}>
                  Submit another crew
                </button>
              </div>
            ) : (
                <form onSubmit={handleWaitlistSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <h3 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 4px 0' }}>Join the MK Network</h3>
                    <p style={{ color: '#555', fontSize: 13, margin: 0 }}>Register your crew profile to access the Milton Keynes network array.</p>
                  </div>
                  
                  <input type="text" placeholder="Full Name / Fleet Lead" value={driverName} onChange={(e) => setDriverName(e.target.value)} required />
                  <input type="tel" placeholder="Mobile Contact Number" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} required />
                  <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  
                  <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc', background: 'white' }}>
                    <option value="Driver">Professional Driver</option>
                    <option value="Porter">Delivery Porter / Mate</option>
                  </select>

                  <input type="text" placeholder="Vehicle Make" value={make} onChange={(e) => setMake(e.target.value)} />
                  <input type="text" placeholder="Vehicle Model" value={model} onChange={(e) => setModel(e.target.value)} />
                  <input type="number" placeholder="Vehicle Year" value={year} onChange={(e) => setYear(e.target.value)} />

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555', cursor: 'pointer' }}>
                    <input type="checkbox" checked={isInsured} onChange={(e) => setIsInsured(e.target.checked)} required />
                    I confirm I hold valid Goods in Transit insurance.
                  </label>

                  <button type="submit" disabled={waitlistLoading} className="btn-green" style={{ width: '100%', padding: 16, fontSize: 15, background: '#111' }}>
                    {waitlistLoading ? 'Securing Allocation...' : 'Secure Route Allocation Spot →'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )
      ) : (
        /* SECURE BACKEND LOGISTICS DASHBOARD (ROLE EXTRACTED & LOCKED) */
        <div className="form-panel" style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, textTransform: 'capitalize' }}>
              {roleMode} Workspace
            </h2>
            <p style={{ color: '#666', fontSize: 11, margin: '2px 0 0 0' }}>
              Secure encrypted connection to the Ben Milton Keynes delivery hub node.
            </p>
          </div>
          
          {/* Renders ONLY the user's specific workflow based on their extracted role */}
          <BookJobForm retailerId={session.user.id} mode={roleMode} />
        </div>
      )}
    </div>
  )
}

function BookJobForm({ retailerId, mode }: { retailerId: string, mode: 'retailer' | 'driver' }) {
  const [jobData, setJobData] = useState({ vehicle_setup: 'clientVehicle', loop_profile: 'assembly', pickup_address: '', drop_addresses: '' })
  const [activeJobs, setActiveJobs] = useState<any[]>([])
  const [complianceAccepted, setComplianceAccepted] = useState(false)
  const [retailerTab, setRetailerTab] = useState<'book' | 'track' | 'ledger'>('book')
  const [activeGateJobId, setActiveGateJobId] = useState<string | null>(null)
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null)
  const [customerSignee, setCustomerSignee] = useState('')
  const [dropImage, setDropImage] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const fetchLogisticsData = async () => {
    const { data: jobs } = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
    if (jobs) setActiveJobs(jobs)
  }

  const uploadPoD = async (jobId: string, file: File) => {
    // 1. Upload file to Supabase Storage
    const { data: uploadData, error } = await supabase.storage
      .from('pod-images')
      .upload(`${jobId}/${Date.now()}.jpg`, file);
    
    if (uploadData) {
      // 2. Update job status to Completed
      await supabase.from('jobs').update({ status: 'Completed' }).eq('id', jobId);
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
      return [date, `"${job.pickup_address}"`, 380, 57].join(",");
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
    const { data } = await supabase.from('jobs').insert([{ retailer_id: retailerId, pickup_address: jobData.pickup_address, drop_addresses: jobData.drop_addresses, status: 'Unassigned' }]).select();
    if (data) {
      await supabase.from('payouts').insert([{ job_id: data[0].id, total_charged_to_retailer: 380, payout_status: 'Pending' }]);
      fetchLogisticsData();
    }
  }

  const parseDrops = (job: any) => job.drop_addresses ? job.drop_addresses.split(',').map((a: string) => a.trim()) : [];
  const activeDriverJob = activeJobs.find(job => job.status === 'Assigned' || job.status === 'In Progress');

  return (
    <div style={{ textAlign: 'left' }}>
      {mode === 'retailer' ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, background: '#f8fafc', padding: 6, borderRadius: 12, marginBottom: 24 }}>
            <button onClick={() => setRetailerTab('book')} style={{ fontWeight: 800, padding: 8 }}>📝 Book</button>
            <button onClick={() => setRetailerTab('track')} style={{ fontWeight: 800, padding: 8 }}>📡 Track</button>
            <button onClick={() => setRetailerTab('ledger')} style={{ fontWeight: 800, padding: 8 }}>💰 Ledger</button>
          </div>
          {retailerTab === 'book' && (
             <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:10}}>
                <input placeholder="Pickup" onChange={e => setJobData({...jobData, pickup_address: e.target.value})} required/>
                <input placeholder="Drops" onChange={e => setJobData({...jobData, drop_addresses: e.target.value})} required/>
                <button type="submit" className="btn-green">Launch Route Array →</button>
             </form>
          )}
          {retailerTab === 'track' && activeJobs.filter(j => j.retailer_id === retailerId).map(j => (
            <div key={j.id} style={{padding:16, border:'1px solid #eee', marginBottom:8}}>{j.pickup_address} - {j.status}</div>
          ))}
          {retailerTab === 'ledger' && (
            <div style={{ padding: 24, background: 'white', borderRadius: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Agency Settlement Ledger</h3>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    Cumulative Commission: 
                    <span style={{ fontWeight: 800, color: '#16a34a', marginLeft: 8 }}>
                      £{activeJobs.filter(j => j.status === 'Completed').length * 57}
                    </span>
                  </p>
                </div>
                <button onClick={exportLedgerToCSV} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: '1px solid #111', background: 'white', cursor: 'pointer' }}>⬇ Export CSV</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeJobs.filter(j => j.status === 'Completed').map(job => (
                  <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{job.pickup_address}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{new Date(job.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#16a34a' }}>+£57.00</div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8' }}>Comm. Earned</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : mode === 'driver' && !complianceAccepted ? (
        <div style={{ padding: 32, border: '2px solid #ef4444', borderRadius: 20, background: '#FEF2F2' }}>
          <h3 style={{ color: '#B91C1C', marginTop: 0, fontSize: 20 }}>⚠️ Independent Contractor Agreement</h3>
          <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6, marginBottom: 20, textAlign: 'left' }}>
            <p>By proceeding, you confirm the following:</p>
            <ul style={{ paddingLeft: 20 }}>
              <li>You are a self-employed business entity.</li>
              <li>You are responsible for your own tax and National Insurance contributions.</li>
              <li>You provide your own insurance and vehicle assets.</li>
              <li>This platform acts as an agent; you are not an employee of Ben Logistics.</li>
            </ul>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700 }}>
              <input type="checkbox" onChange={(e) => setComplianceAccepted(e.target.checked)} style={{ width: 18, height: 18 }} />
              I have read and agree to the Independent Contractor terms.
            </label>
          </div>
          <button 
            disabled={!complianceAccepted} 
            onClick={() => setComplianceAccepted(true)} 
            className="btn-green" 
            style={{ 
              background: complianceAccepted ? '#B91C1C' : '#D1D5DB', 
              width: '100%', 
              padding: 16, 
              border: 'none', 
              borderRadius: 12, 
              color: 'white',
              cursor: complianceAccepted ? 'pointer' : 'not-allowed'
            }}
          >
            Initialize Secure Driver Portal
          </button>
        </div>
      ) : (
        <div style={{ padding: 20 }}>
          {activeDriverJob ? (
  <div style={{ background: '#111827', color: 'white', padding: 20, borderRadius: 16 }}>
    <h3>📍 Active Loop: {activeDriverJob.pickup_address}</h3>
    <p>Status: {activeDriverJob.status}</p>
    {parseDrops(activeDriverJob).map((d: string, i: number) => (
      <div key={i} style={{ marginBottom: 10 }}>• {d}</div>
    ))}
    
    <div style={{ marginTop: 20, borderTop: '1px solid #374151', paddingTop: 20 }}>
      <label style={{ display: 'block', marginBottom: 10, cursor: 'pointer', background: '#3b82f6', padding: '12px', borderRadius: 8, textAlign: 'center', fontWeight: 700 }}>
        Upload Proof of Delivery
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          style={{ display: 'none' }} 
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
              <h3>Open Freight Board</h3>
              {activeJobs.filter(j => j.status === 'Unassigned').map(j => (
                <button 
                  key={j.id} 
                  onClick={() => supabase.from('jobs').update({ status: 'Assigned' }).eq('id', j.id).then(fetchLogisticsData)} 
                  className="btn-green" 
                  style={{ width: '100%', marginBottom: 10, padding: 12 }}
                >
                  Claim {j.pickup_address}
                </button>
              ))}
            </div>
          )}
          <div style={{ marginTop: 40, padding: 20, borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Ben Logistics Agency Node • Independent Contractor Status Active
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

