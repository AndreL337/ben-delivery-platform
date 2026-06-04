import { useState } from 'react'
import './App.css'

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#FAFAF7', minHeight: '100vh' }}>

      {/* HEADER */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        boxShadow: '0 1px 12px rgba(0,0,0,0.06)', padding: '0'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, background: '#52BE80', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18 }}>B</div>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 20, color: '#111' }}>Ben</span>
          </div>
          <nav style={{ display: 'flex', gap: 32, fontSize: 14, fontWeight: 500, color: '#555' }}>
            {['Services', 'How It Works', 'About', 'Contact'].map(n => (
              <a key={n} href={`#${n.toLowerCase().replace(' ', '-')}`} style={{ color: '#555', transition: 'color 0.2s' }}
                onMouseOver={e => (e.currentTarget.style.color = '#52BE80')}
                onMouseOut={e => (e.currentTarget.style.color = '#555')}>{n}</a>
            ))}
          </nav>
          <a href="#contact" className="btn-primary" style={{ padding: '10px 24px', fontSize: 14 }}>Get Started</a>
        </div>
      </header>

      {/* HERO */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        background: 'linear-gradient(135deg, #F9E79F 0%, #A9DFBF 50%, #FAFAF7 100%)',
        paddingTop: 80
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ display: 'inline-block', padding: '8px 20px', background: 'rgba(255,255,255,0.8)', borderRadius: 50, fontSize: 14, fontWeight: 500, color: '#444', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              ✨ Smart Delivery Platform
            </div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '4rem', fontWeight: 800, lineHeight: 1.1, color: '#111' }}>
              Connect Directly.<br />
              <span style={{ color: '#52BE80' }}>Deliver Reliably.</span>
            </h1>
            <p style={{ fontSize: '1.1rem', color: '#555', lineHeight: 1.7, maxWidth: 480 }}>
              Ben connects UK retailers directly with vetted, insured 2-man delivery professionals. Eliminate subcontractor layers, improve reliability, and enjoy transparent pricing with proof of delivery.
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              <a href="#contact" className="btn-primary">Request Consultation →</a>
              <a href="#services" className="btn-outline">View Services</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 32, paddingTop: 8 }}>
              {[['500+', 'Vetted Crews'], ['98%', 'On-Time Rate'], ['24/7', 'Support']].map(([val, label]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '2rem', fontWeight: 700, color: '#52BE80' }}>{val}</span>
                  <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.12)' }}>
            <img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80" alt="Delivery team" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.5rem', fontWeight: 700, textAlign: 'center', color: '#111', marginBottom: 12 }}>Built for Every Side</h2>
          <p style={{ textAlign: 'center', color: '#888', marginBottom: 64, maxWidth: 500, margin: '0 auto 64px' }}>Everything you need to streamline your delivery operations.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {[
              { title: 'For Retailers', desc: 'Reduce delivery costs by up to 35% while improving reliability and customer satisfaction.', icon: '📦', cta: 'Learn More' },
              { title: 'For Delivery Crews', desc: 'Get consistent work, fair pay, and professional support. Join our network of vetted professionals.', icon: '🚚', cta: 'Join as Crew' },
              { title: 'For Enterprises', desc: 'Custom solutions, dedicated support, and advanced integrations for large-scale operations.', icon: '🏢', cta: 'Contact Sales' },
            ].map(s => (
              <div key={s.title} style={{ background: '#FAFAF7', borderRadius: 20, padding: 32, border: '1px solid #eee' }}>
                <div style={{ width: 48, height: 48, background: '#A9DFBF', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 24 }}>{s.icon}</div>
                <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.2rem', color: '#111', marginBottom: 12 }}>{s.title}</h3>
                <p style={{ color: '#666', marginBottom: 24, lineHeight: 1.6 }}>{s.desc}</p>
                <button className="btn-primary" style={{ width: '100%', padding: '12px 24px' }}>{s.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding: '96px 24px', background: '#FAFAF7' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.5rem', fontWeight: 700, textAlign: 'center', color: '#111', marginBottom: 12 }}>How Ben Works</h2>
          <p style={{ textAlign: 'center', color: '#888', marginBottom: 64, maxWidth: 500, margin: '0 auto 64px' }}>From signup to successful delivery in minutes.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {[
              { n: '01', title: 'Sign Up', desc: 'Create your Ben account in minutes. Provide basic business information and set up your delivery preferences.' },
              { n: '02', title: 'Browse Crews', desc: 'Explore our network of vetted, insured delivery professionals. Filter by availability, location, and ratings.' },
              { n: '03', title: 'Book Delivery', desc: 'Select your crew and confirm the delivery. See transparent pricing upfront with no hidden fees.' },
              { n: '04', title: 'Track in Real-Time', desc: 'Monitor your delivery from pickup to drop-off with instant notifications and live GPS tracking.' },
              { n: '05', title: 'Delivery Complete', desc: 'Crew arrives and delivers your items. Receive photo and signature confirmation instantly.' },
              { n: '06', title: 'Review & Optimise', desc: 'View delivery analytics, crew ratings, and cost breakdowns. Optimise for future deliveries.' },
            ].map(s => (
              <div key={s.n} style={{ background: 'white', borderRadius: 20, padding: 32, border: '1px solid #eee' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#A9DFBF', marginBottom: 16 }}>{s.n}</div>
                <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: '#111', marginBottom: 8 }}>{s.title}</h3>
                <p style={{ color: '#666', fontSize: 14, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.5rem', fontWeight: 700, textAlign: 'center', color: '#111', marginBottom: 12 }}>Get Started with Ben</h2>
          <p style={{ textAlign: 'center', color: '#888', marginBottom: 48 }}>Request a delivery crew for your store. We'll be in touch within 24 hours.</p>
          <RetailerForm />
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#111', color: 'white', padding: '48px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, background: '#52BE80', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>B</div>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 18 }}>Ben</span>
          </div>
          <p style={{ color: '#888', fontSize: 14 }}>© 2026 Ben. Smart Delivery Platform. All rights reserved.</p>
          <div style={{ display: 'flex', gap: 24, fontSize: 14, color: '#888' }}>
            {['Privacy', 'Terms', 'Contact'].map(l => <a key={l} href="#" style={{ color: '#888' }}>{l}</a>)}
          </div>
        </div>
      </footer>

    </div>
  )
}

function RetailerForm() {
  const [formData, setFormData] = useState({ name: '', contact_name: '', email: '', phone: '', region: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = (window as any).supabase.createClient(
        'https://taqwjalqflxxuskschzc.supabase.co',
        'sb_publishable_O6UTqJSmaEUl0ua23lh0zw_TUblF7U5'
      )
      const { error } = await supabase.from('retailers').insert([formData])
      if (error) throw error
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  if (submitted) return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
      <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#111', marginBottom: 8 }}>Thank you!</h3>
      <p style={{ color: '#666' }}>We'll be in touch within 24 hours.</p>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <p style={{ color: 'red', fontSize: 14 }}>{error}</p>}
      {[
        { name: 'name', placeholder: 'Company name' },
        { name: 'contact_name', placeholder: 'Your name' },
        { name: 'email', placeholder: 'Email address', type: 'email' },
        { name: 'phone', placeholder: 'Phone number' },
        { name: 'region', placeholder: 'Region (e.g. Milton Keynes)' },
      ].map(f => (
        <input
          key={f.name}
          name={f.name}
          type={f.type || 'text'}
          placeholder={f.placeholder}
          onChange={handleChange}
          required
          style={{ width: '100%', padding: '14px 18px', border: '1.5px solid #e0e0e0', borderRadius: 14, fontSize: 16, color: '#111', outline: 'none', fontFamily: 'Inter, sans-serif' }}
        />
      ))}
      <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', marginTop: 8 }}>
        {loading ? 'Submitting...' : 'Request Consultation →'}
      </button>
    </form>
  )
}