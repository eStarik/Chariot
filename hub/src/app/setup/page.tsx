'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Establishing Imperial Identity...');

    try {
      const res = await fetch('/api/v1/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setStatus('Legion Command Established. Redirecting to Portal...');
        setTimeout(() => router.push('/login'), 2000);
      } else {
        setStatus(`Error: ${data.error}`);
        setLoading(false);
      }
    } catch (error) {
      setStatus('Strategic Comms Failure.');
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#121212', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '2rem',
      backgroundImage: 'radial-gradient(circle at center, #1e2022 0%, #0a0a0a 100%)'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '450px', 
        backgroundColor: '#1e2022', 
        border: '1px solid var(--accent-bronze)', 
        position: 'relative' 
      }}>
        {/* Top Decorative Border */}
        <div style={{ 
          height: '4px', 
          width: '100%', 
          background: 'linear-gradient(90deg, #9b111e, #b08d57)' 
        }} />

        <div style={{ padding: '3rem 2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h1 style={{ 
              fontFamily: 'Georgia, serif', 
              color: 'var(--accent-bronze)', 
              fontSize: '1.8rem', 
              letterSpacing: '8px', 
              margin: '0 0 1rem 0',
              fontWeight: 'normal'
            }}>IMPERIAL INITIATION</h1>
            <p style={{ 
              color: 'rgba(176, 141, 87, 0.5)', 
              fontSize: '10px', 
              textTransform: 'uppercase', 
              fontWeight: 'bold',
              letterSpacing: '2px'
            }}>
              Establish the First Command of the Legion
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ 
                display: 'block', 
                color: 'var(--accent-bronze)', 
                fontSize: '10px', 
                textTransform: 'uppercase', 
                fontWeight: 'bold', 
                marginBottom: '0.5rem',
                fontFamily: 'Georgia, serif'
              }}>Commander Name</label>
              <input 
                required
                type="text" 
                placeholder="e.g. Leonidas"
                style={{ 
                  width: '100%', 
                  backgroundColor: '#121212', 
                  border: '1px solid rgba(176, 141, 87, 0.2)', 
                  padding: '12px', 
                  color: 'white', 
                  outline: 'none',
                  fontSize: '14px'
                }}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                color: 'var(--accent-bronze)', 
                fontSize: '10px', 
                textTransform: 'uppercase', 
                fontWeight: 'bold', 
                marginBottom: '0.5rem',
                fontFamily: 'Georgia, serif'
              }}>Imperial Email (Login)</label>
              <input 
                required
                type="email" 
                placeholder="commander@chariot.hub"
                style={{ 
                  width: '100%', 
                  backgroundColor: '#121212', 
                  border: '1px solid rgba(176, 141, 87, 0.2)', 
                  padding: '12px', 
                  color: 'white', 
                  outline: 'none',
                  fontSize: '14px'
                }}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                color: 'var(--accent-bronze)', 
                fontSize: '10px', 
                textTransform: 'uppercase', 
                fontWeight: 'bold', 
                marginBottom: '0.5rem',
                fontFamily: 'Georgia, serif'
              }}>Access Cipher</label>
              <input 
                required
                type="password" 
                placeholder="••••••••"
                style={{ 
                  width: '100%', 
                  backgroundColor: '#121212', 
                  border: '1px solid rgba(176, 141, 87, 0.2)', 
                  padding: '12px', 
                  color: 'white', 
                  outline: 'none',
                  fontSize: '14px'
                }}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <button 
              disabled={loading}
              type="submit" 
              style={{ 
                marginTop: '1.5rem',
                backgroundColor: 'transparent', 
                border: '1px solid var(--accent-bronze)', 
                color: 'var(--accent-bronze)', 
                padding: '14px', 
                cursor: 'pointer', 
                textTransform: 'uppercase', 
                letterSpacing: '2px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-bronze)';
                e.currentTarget.style.color = '#1e2022';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--accent-bronze)';
              }}
            >
              {loading ? 'ESTABLISHING...' : 'INITIALIZE REGISTRY'}
            </button>

            {status && (
              <p style={{ 
                textAlign: 'center', 
                fontSize: '10px', 
                color: status.startsWith('Error') ? '#ff3333' : '#b08d57', 
                fontFamily: 'monospace',
                marginTop: '1rem'
              }}>
                [ {status.toUpperCase()} ]
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
