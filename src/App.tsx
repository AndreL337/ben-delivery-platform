import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase using your environment variables or fallback placeholders
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project-id.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummykey';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [retailerTab, setRetailerTab] = useState<'book' | 'track' | 'ledger'>('book');
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // Background Live Syncing for Jobs List
  const fetchLogisticsData = async () => {
    try {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });
      if (jobs) setActiveJobs(jobs);
    } catch (err) {
      console.error("Data fetch error:", err);
    }
  };

  useEffect(() => {
    fetchLogisticsData();
    const interval = setInterval(fetchLogisticsData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Public Waitlist Form Handler
  const handleWaitlistSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setWaitlistLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const payload = {
      full_name: formData.get('full_name'),
      phone_number: formData.get('phone_number'),
      vehicle_type: formData.get('vehicle_type'),
      region: 'Milton Keynes',
      is_insured: formData.get('is_insured') === 'true'
    };

    try {
      const { error } = await supabase.from('driver_waitlist').insert([payload]);
      if (error) throw error;
      setWaitlistSubmitted(true);
    } catch (error) {
      console.error(error);
      alert('Waitlist submission error. Please try again.');
    } finally {
      setWaitlistLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', minHeight: '100vh', backgroundColor: '#f1f5f9', padding: '40px 20px', color: '#0f172a' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        
        {/* HEADER BRAND BAR */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, borderBottom: '1px solid #e2e8f0', paddingBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, trackingLetter: '-0.03em', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 32 }}>🚚</span> BEN <span style={{ fontWeight: 400, color: '#64748b', fontSize: 24 }}>LOGISTICS</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0 0', fontWeight: 500 }}>Milton Keynes Carrier & Operations Hub</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', padding: '8px 16px', borderRadius: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Operational Infrastructure Link Live</span>
          </div>
        </header>

        {/* SECTION 1: PUBLIC DRIVER WAITLIST MODULE */}
        <section style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 32, marginBottom: 32, boxShadow: '0 4px 10px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -1px rgba(15, 23, 42, 0.02)', border: '1px solid #e2e8f0' }}>
          <div style={{ borderLeft: '4px solid #0f172a', paddingLeft: 16, marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#0f172a' }}>Crew Gateway Registry</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: 14 }}>Supply-side onboard pipeline optimization</p>
          </div>
          
          {waitlistSubmitted ? (
            <div style={{ padding: '20px 24px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: 12, fontWeight: 600, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 12, fontSize: 15 }}>
              <span style={{ fontSize: 22 }}>🎉</span> Fleet Entry Registered & Logged! Core automated validation routing active.
            </div>
          ) : (
            <form onSubmit={handleWaitlistSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Lead Driver Name</label>
                <input name="full_name" placeholder="John Doe" required style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', backgroundColor: '#f8fafc', transition: 'border 0.2s' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Mobile Contact</label>
                <input name="phone_number" placeholder="07123 456789" required style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', backgroundColor: '#f8fafc' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Asset Configuration Setup</label>
                <select name="vehicle_type" style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: 14, outline: 'none' }}>
                  <option value="Van Crew">2-Man Van Crew (3.5T LWB)</option>
                  <option value="Porter/Mate">Independent Porter / Mate</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', color: '#475569', fontWeight: 500, userSelect: 'none' }}>
                  <input type="checkbox" name="is_insured" value="true" required style={{ width: 18, height: 18, accentColor: '#0f172a', cursor: 'pointer' }} /> 
                  <span>GIT & Public Liability Insured</span>
                </label>
                <button type="submit" disabled={waitlistLoading} style={{ padding: '12px 24px', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                  {waitlistLoading ? 'Processing Pipeline...' : 'Request Registry Entry →'}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* SECTION 2: SYSTEM OPERATIONS CORE CONTROLLER */}
        <main style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 32, boxShadow: '0 4px 10px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -1px rgba(15, 23, 42, 0.02)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, borderBottom: '1px solid #f1f5f9', paddingBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0f172a' }}>System Control Environment</h2>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: 14 }}>Real-time manifest injection and route validation engine</p>
            </div>
          </div>

          {/* Tab Switcher Dashboard Controls */}
          <div style={{ display: 'flex', gap: 8, backgroundColor: '#f1f5f9', padding: 6, borderRadius: 10, marginBottom: 32, maxWidth: 450 }}>
            <button onClick={() => setRetailerTab('book')} style={{ flex: 1, padding: '10px 16px', backgroundColor: retailerTab === 'book' ? '#ffffff' : 'transparent', color: retailerTab === 'book' ? '#0f172a' : '#64748b', fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', boxShadow: retailerTab === 'book' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: 14, transition: 'all 0.15s' }}>Book Manifest</button>
            <button onClick={() => setRetailerTab('track')} style={{ flex: 1, padding: '10px 16px', backgroundColor: retailerTab === 'track' ? '#ffffff' : 'transparent', color: retailerTab === 'track' ? '#0f172a' : '#64748b', fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', boxShadow: retailerTab === 'track' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: 14, transition: 'all 0.15s' }}>Track Runs ({activeJobs.length})</button>
            <button onClick={() => setRetailerTab('ledger')} style={{ flex: 1, padding: '10px 16px', backgroundColor: retailerTab === 'ledger' ? '#ffffff' : 'transparent', color: retailerTab === 'ledger' ? '#0f172a' : '#64748b', fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', boxShadow: retailerTab === 'ledger' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: 14, transition: 'all 0.15s' }}>Audit Ledger</button>
          </div>

          {/* Tab Content Components */}
          <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
            {retailerTab === 'book' && <BookJobForm retailerId="RETAIL-01" mode="retailer" onJobCreated={fetchLogisticsData} />}
            {retailerTab === 'track' && <TrackView activeJobs={activeJobs} fetchLogisticsData={fetchLogisticsData} />}
            {retailerTab === 'ledger' && <LedgerView activeJobs={activeJobs} />}
          </div>
        </main>

      </div>
    </div>
  );
}

/* ==========================================================================
   1. BOOK JOB FORM COMPONENT
   ========================================================================== */
function BookJobForm({ retailerId, mode, onJobCreated }: { retailerId: string, mode: 'retailer' | 'driver', onJobCreated: () => void }) { 
  const [jobData, setJobData] = useState({ 
    vehicle_setup: 'clientVehicle', 
    loop_profile: 'assembly', 
    pickup_address: '', 
    drop_addresses: '' 
  });
  const [complianceAccepted, setComplianceAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (!complianceAccepted) {
      alert("Compliance framework agreement validation required.");
      return;
    }
    
    const dropArray = jobData.drop_addresses
      .split('\n')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0)
      .map(addr => ({ address: addr, status: 'Pending', signed_by: null, signature_img: null }));

    const payload = {
      retailer_id: retailerId,
      vehicle_setup: jobData.vehicle_setup,
      loop_profile: jobData.loop_profile,
      pickup_address: jobData.pickup_address,
      drops: dropArray,
      status: 'Unassigned',
      created_at: new Date().toISOString()
    };

    try {
      setLoading(true);
      const { error } = await supabase.from('jobs').insert([payload]);
      if (error) throw error;
      
      setJobData({ vehicle_setup: 'clientVehicle', loop_profile: 'assembly', pickup_address: '', drop_addresses: '' });
      setComplianceAccepted(false);
      onJobCreated();
      alert("Operational manifest injected successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to inject manifest.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Fleet Asset Profile Requirements</label>
          <select 
            value={jobData.vehicle_setup} 
            onChange={e => setJobData({ ...jobData, vehicle_setup: e.target.value })}
            style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: 14, outline: 'none' }}
          >
            <option value="clientVehicle">Independent 3.5T Box Van Setup</option>
            <option value="lutonTailLift">Luton Van with Hydraulic Tail Lift</option>
            <option value="flatbedSecure">Flatbed with Heavy Freight Strapping</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Workflow Standard Handling Loop</label>
          <select 
            value={jobData.loop_profile} 
            onChange={e => setJobData({ ...jobData, loop_profile: e.target.value })}
            style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: 14, outline: 'none' }}
          >
            <option value="assembly">White-Glove In-Home Room Assembly</option>
            <option value="threshold">Standard Threshold Curbside Drop</option>
            <option value="crossdock">Cross-Dock Consolidation Swap</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Origin Base Depot Address</label>
        <input 
          type="text" 
          value={jobData.pickup_address}
          onChange={e => setJobData({ ...jobData, pickup_address: e.target.value })}
          placeholder="e.g., Ben Logistics Hub MK, Unit 4B Industrial Way, Milton Keynes"
          required 
          style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: 14, outline: 'none' }} 
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Consignment Destination Nodes (One Drop Address per line)</label>
        <textarea 
          rows={4}
          value={jobData.drop_addresses}
          onChange={e => setJobData({ ...jobData, drop_addresses: e.target.value })}
          placeholder="10 Saxon Gate, Milton Keynes MK9 2EQ&#10;52 Silbury Blvd, Milton Keynes MK9 2AZ"
          required 
          style={{ padding: 14, borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontFamily: 'monospace', fontSize: 13, outline: 'none', lineHeight: '1.5' }} 
        />
      </div>

      <label style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', backgroundColor: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', color: '#475569', lineHeight: '1.4' }}>
        <input 
          type="checkbox" 
          checked={complianceAccepted}
          onChange={e => setComplianceAccepted(e.target.checked)}
          style={{ marginTop: 2, width: 16, height: 16, accentColor: '#0f172a' }} 
        />
        <span>I attest that all specified consignments perfectly match operational dimension parameters and meet cross-jurisdiction regulatory transit compliance framework standards.</span>
      </label>

      <button type="submit" disabled={loading} style={{ padding: '14px 28px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', alignSelf: 'flex-start', fontSize: 14, boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)', transition: 'all 0.2s' }}>
        {loading ? "Injecting Sequence..." : "Commit Manifest RunSequence →"}
      </button>
    </form>
  ); 
}

/* ==========================================================================
   2. OPERATIONAL TRACK VIEW TERMINAL
   ========================================================================== */
function TrackView({ activeJobs, fetchLogisticsData }: { activeJobs: any[], fetchLogisticsData: () => void }) {
  const [activeGateJobId, setActiveGateJobId] = useState<string | null>(null);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const [customerSignee, setCustomerSignee] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Drawing Canvas mechanics
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const updateJobStatus = async (jobId: string, nextStatus: string) => {
    try {
      const { error } = await supabase.from('jobs').update({ status: nextStatus }).eq('id', jobId);
      if (error) throw error;
      fetchLogisticsData();
    } catch (err) {
      console.error(err);
    }
  };

  const commitDropCompletion = async (job: any) => {
    if (!customerSignee.trim() || !canvasRef.current) {
      alert("Signee naming and canvas structural authorization data required.");
      return;
    }

    const signatureDataUrl = canvasRef.current.toDataURL();
    const updatedDrops = [...job.drops];
    
    if (activeDropIndex !== null) {
      updatedDrops[activeDropIndex] = {
        ...updatedDrops[activeDropIndex],
        status: 'Completed',
        signed_by: customerSignee,
        signature_img: signatureDataUrl
      };
    }

    const allDone = updatedDrops.every(d => d.status === 'Completed');
    const nextSystemStatus = allDone ? 'Completed' : 'In Transit';

    try {
      const { error } = await supabase
        .from('jobs')
        .update({ drops: updatedDrops, status: nextSystemStatus })
        .eq('id', job.id);

      if (error) throw error;
      
      setCustomerSignee('');
      setActiveDropIndex(null);
      fetchLogisticsData();
      alert("Node verification token finalized into immutable routing store.");
    } catch (err) {
      console.error(err);
    }
  };

  if (activeJobs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
        <p style={{ fontSize: 28, margin: '0 0 10px 0' }}>📦</p>
        <p style={{ margin: 0, fontStyle: 'italic', fontSize: 14 }}>No active manifest pipelines detected in systemic routing store arrays.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {activeJobs.map(job => (
        <div key={job.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, backgroundColor: '#f8fafc', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, backgroundColor: '#e2e8f0', padding: '3px 8px', borderRadius: 4, color: '#334155' }}>ID: {job.id.substring(0,8).toUpperCase()}</span>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Loop: <strong style={{ color: '#0f172a' }}>{job.loop_profile}</strong></span>
              </div>
              <h3 style={{ margin: '6px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Origin: {job.pickup_address}</h3>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 500 }}>Equipment Rig Specs: <strong style={{ color: '#475569' }}>{job.vehicle_setup}</strong></p>
            </div>
            <span style={{ padding: '6px 14px', borderRadius: 30, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', backgroundColor: job.status === 'Completed' ? '#dcfce7' : job.status === 'In Transit' ? '#fef9c3' : '#f1f5f9', color: job.status === 'Completed' ? '#166534' : job.status === 'In Transit' ? '#854d0e' : '#475569', border: `1px solid ${job.status === 'Completed' ? '#bbf7d0' : job.status === 'In Transit' ? '#fef08a' : '#e2e8f0'}` }}>
              {job.status}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {job.status === 'Unassigned' && (
              <button onClick={() => updateJobStatus(job.id, 'Dispatched')} style={{ backgroundColor: '#0f172a', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Assign & Dispatch Unit</button>
            )}
            {job.status === 'Dispatched' && (
              <button onClick={() => updateJobStatus(job.id, 'In Transit')} style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13, boxShadow: '0 2px 4px rgba(37,99,235,0.1)' }}>Confirm Origin Intake Arrival</button>
            )}
            <button onClick={() => setActiveGateJobId(activeGateJobId === job.id ? null : job.id)} style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13, color: '#334155', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              {activeGateJobId === job.id ? "Collapse Destination Matrix" : "Access Node Terminal Gate"}
            </button>
          </div>

          {activeGateJobId === job.id && (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginTop: 20 }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Route Node Consignments Array</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {job.drops?.map((drop: any, index: number) => (
                  <div key={index} style={{ border: '1px solid #e2e8f0', padding: 16, borderRadius: 8, backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Drop Reference #{index + 1}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#475569' }}>{drop.address}</p>
                      {drop.status === 'Completed' && (
                        <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>✓ Verified Delivery Token Handover:</span> <strong style={{ color: '#15803d' }}>{drop.signed_by}</strong>
                        </p>
                      )}
                    </div>
                    
                    {drop.status !== 'Completed' ? (
                      <button onClick={() => { setActiveDropIndex(index); clearCanvas(); }} style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13, boxShadow: '0 2px 4px rgba(22,163,74,0.1)' }}>
                        Launch POD Terminal
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: 20, fontWeight: 700, border: '1px solid #bbf7d0' }}>Settled Node</span>
                    )}
                  </div>
                ))}
              </div>

              {activeDropIndex !== null && (
                <div style={{ border: '2px solid #2563eb', borderRadius: 10, padding: 24, marginTop: 20, backgroundColor: '#f8fafc' }}>
                  <h5 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Secure Proof-Of-Delivery Interface: Drop #{activeDropIndex + 1}</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Signee Authorization Printed Legal Name</label>
                      <input type="text" value={customerSignee} onChange={e => setCustomerSignee(e.target.value)} placeholder="e.g., S. Smith" style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: 14, outline: 'none' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Electronic Signature Capture Matrix</label>
                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 4, display: 'inline-block', maxWidth: '100%' }}>
                        <canvas 
                          ref={canvasRef}
                          width={450} 
                          height={160} 
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={() => setIsDrawing(false)}
                          onMouseLeave={() => setIsDrawing(false)}
                          style={{ display: 'block', maxWidth: '100%', backgroundColor: '#ffffff', cursor: 'crosshair' }} 
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button onClick={() => commitDropCompletion(job)} style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Incorporate Verification Token</button>
                      <button onClick={clearCanvas} style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13, color: '#475569' }}>Clear Grid</button>
                      <button onClick={() => setActiveDropIndex(null)} style={{ backgroundColor: '#ef4444', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Abort Verification</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   3. FINANCIAL AUDIT LEDGER COMPONENT
   ========================================================================== */
function LedgerView({ activeJobs }: { activeJobs: any[] }) {
  const completedJobs = activeJobs.filter(j => j.status === 'Completed');

  const exportLedgerToCSV = () => { 
    if (completedJobs.length === 0) {
      alert("No cleared transaction nodes available for extraction compilation.");
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,Manifest ID,Origin Base,Total Drop Nodes,Timestamp Settled\n";
    completedJobs.forEach(j => {
      csvContent += `${j.id},"${j.pickup_address}",${j.drops?.length || 0},${j.created_at}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ben_logistics_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }; 

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Settled Operational Accounts</p>
          <h4 style={{ margin: '4px 0 0 0', fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{completedJobs.length} <span style={{ fontWeight: 400, color: '#64748b', fontSize: 18 }}>Immutable Invoices Logged</span></h4>
        </div>
        <button onClick={exportLedgerToCSV} style={{ padding: '12px 24px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          Compile Ledger Audit Extract (.CSV)
        </button>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14, backgroundColor: '#ffffff' }}>
            <thead style={{ backgroundColor: '#f1f5f9', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '14px 20px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manifest Reference Token</th>
                <th style={{ padding: '14px 20px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Origin Hub</th>
                <th style={{ padding: '14px 20px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fulfillment Consignments</th>
                <th style={{ padding: '14px 20px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Lifecycle State</th>
              </tr>
            </thead>
            <tbody>
              {activeJobs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '32px 20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>No pipeline metrics stored.</td>
                </tr>
              ) : (
                activeJobs.map(job => (
                  <tr key={job.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'backgroundColor 0.2s' }}>
                    <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#2563eb' }}>{job.id.substring(0,12).toUpperCase()}...</td>
                    <td style={{ padding: '16px 20px', fontWeight: 600, color: '#334155' }}>{job.pickup_address || "Ben Central Depot Base"}</td>
                    <td style={{ padding: '16px 20px', color: '#475569', fontWeight: 500 }}>{job.drops?.length || 0} Complete Drop Nodes</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: job.status === 'Completed' ? '#16a34a' : '#64748b', backgroundColor: job.status === 'Completed' ? '#dcfce7' : '#f1f5f9', padding: '4px 10px', borderRadius: 12 }}>
                        {job.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

