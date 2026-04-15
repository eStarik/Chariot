'use client';

import React, { useState, useEffect } from 'react';
import { useTelemetry } from '@/components/TelemetryContext';

// --- User Management Component ---
const UserManagement = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'commander' });
  const [status, setStatus] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/users');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`[${res.status}] ${text.substring(0, 100)}`);
      }
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (e: any) {
      console.error('Failed to fetch users:', e);
      setStatus(`Deployment Error: ${e.message}`);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/v1/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    if (res.ok) {
      setStatus('Commander Commissioned.');
      setNewUser({ name: '', email: '', password: '', role: 'commander' });
      fetchUsers();
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/v1/users?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setStatus('Commander Decommissioned.');
      fetchUsers();
      setTimeout(() => setStatus(null), 3000);
    } else {
      const data = await res.json();
      setStatus(`Error: ${data.error}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="flex justify-between items-center bg-white/5 p-3 border-l border-bronze/30">
            <div>
              <span className="text-xs font-black uppercase text-bronze mr-4">{u.name}</span>
              <span className="text-[10px] opacity-40 font-mono">{u.email}</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-[9px] font-black tracking-widest bg-bronze/10 px-2 py-1 text-bronze uppercase">{u.role}</span>
              <button 
                onClick={() => handleDelete(u.id)}
                className="text-[10px] text-red-500 font-bold hover:underline opacity-50 hover:opacity-100 uppercase"
              >
                Decommission
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid rgba(176, 141, 87, 0.1)', paddingTop: '1.5rem' }}>
        <h5 className="text-[10px] text-bronze uppercase font-black mb-4">Commission New Commander</h5>
        <form onSubmit={handleCreate} className="grid grid-cols-4 gap-4">
          <input 
            type="text" placeholder="NAME" 
            className="p-2 text-[10px] font-mono bg-[#121212] border border-white/10 outline-none text-white focus:border-bronze"
            value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})}
          />
          <input 
            type="email" placeholder="EMAIL" 
            className="p-2 text-[10px] font-mono bg-[#121212] border border-white/10 outline-none text-white focus:border-bronze"
            value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
          />
          <input 
            type="password" placeholder="PASSWORD" 
            className="p-2 text-[10px] font-mono bg-[#121212] border border-white/10 outline-none text-white focus:border-bronze"
            value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}
          />
          <button type="submit" className="bg-bronze text-[#121212] text-[10px] font-black uppercase hover:bg-white transition-colors">
            Commission
          </button>
        </form>
      </div>
      {status && <div className="text-[10px] font-mono text-bronze text-center mt-4 tracking-widest">[ {status.toUpperCase()} ]</div>}
    </div>
  );
};

// --- Click-to-Copy Component ---
const CopyText = ({ text, label }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && <label className="text-[10px] opacity-40 uppercase font-black block mb-1">{label}</label>}
      <span 
        onClick={handleCopy}
        style={{ 
          color: '#ff3333', 
          fontFamily: 'monospace', 
          fontSize: '0.85rem', 
          cursor: 'pointer', 
          fontWeight: 'bold',
          transition: 'opacity 0.2s',
          borderBottom: '1px dashed rgba(155, 17, 30, 0.3)',
          paddingBottom: '2px',
          display: 'inline-block'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        {copied ? '[ SECURED TO CLIPBOARD ]' : text}
      </span>
    </div>
  );
};

// --- Logistics View ---

export default function LogisticsPage() {
  const { agents } = useTelemetry();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/v1/settings');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`[${res.status}] ${text.substring(0, 50)}`);
      }
      const data = await res.json();
      if (data.success) {
        const mapped = data.settings.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
        setSettings(mapped);
      }
    } catch (e: any) {
      console.error('Failed to fetch settings:', e);
      setSaveStatus(`LOGISTICS FAILURE: ${e.message}`);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleUpdate = async (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value })); // optimistic update
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      if (res.ok) {
        setSaveStatus(`Orchestration Parameter [${key}] Secured.`);
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (e) {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="top-bar">
        <h2 style={{ fontSize: '1rem', color: 'var(--accent-bronze)' }}>Logistics (SuperAdmin)</h2>
        <div className="agent-status" style={{ fontSize: '0.8rem', color: 'var(--status-ready)' }}>
          {saveStatus || 'Operational Parameters // System Maintenance'}
        </div>
      </div>

      <div className="content-body">
        <div className="section-header">
          <h2>SuperAdmin Configuration</h2>
          <span className="text-muted" style={{ fontSize: '0.9rem' }}>Global Orchestration Parameters persistent in Hub database.</span>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="formation-card">
              <h4 className="text-bronze mb-4 uppercase text-xs tracking-widest font-black">Identity & Localization</h4>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] opacity-40 uppercase font-black block mb-2">System Language</label>
                    <select 
                       className="w-full p-2 text-xs font-mono text-bronze outline-none cursor-pointer"
                       style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--chariot-glass-border)' }}
                       value={settings.system_language || ''}
                       onChange={(e) => handleUpdate('system_language', e.target.value)}
                    >
                       <option>ENGLISH (US)</option>
                       <option>LATIN (IMPERIAL)</option>
                       <option>DEUTSCH (EU)</option>
                       <option>ESPAÑOL (EU)</option>
                    </select>
                 </div>
                 <CopyText label="Shared Secret (Registry)" text={process.env.SHARED_SECRET || 'CHARIOT-AGONES-SECURE-ID-XF9'} />
              </div>
           </div>

           <div className="formation-card">
              <h4 className="text-bronze mb-4 uppercase text-xs tracking-widest font-black">Chariot Update Management</h4>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] opacity-40 uppercase font-black block mb-2">Chariot Coordinator Version</label>
                    <input 
                       type="text" 
                       value={settings.chariot_version || ''}
                       onChange={(e) => handleUpdate('chariot_version', e.target.value)}
                       className="w-full p-2 text-xs font-mono text-bronze outline-none" 
                       style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--chariot-glass-border)' }}
                       placeholder="e.g. v3.0.0-phalanx"
                    />
                 </div>
                 <CopyText label="Registry Handshake Token" text="AGONES-COORD-MASTER-HANDSHAKE-0xA9" />
              </div>
           </div>
        </div>

        <div className="section-header">
           <h2>Legion Command</h2>
           <span className="text-muted" style={{ fontSize: '0.9rem' }}>Personnel management and permission assignments.</span>
        </div>

        <div className="grid grid-cols-1 gap-8 mb-12">
            <div className="formation-card">
               <h4 className="text-bronze mb-4 uppercase text-xs tracking-widest font-black">Authorized Commanders</h4>
               <UserManagement />
            </div>
        </div>

        <div className="section-header">
           <h2>Agent Logistics</h2>
           <span className="text-muted" style={{ fontSize: '0.9rem' }}>Active Spoke Federation Management</span>
        </div>

        <div className="space-y-2">
           {Object.keys(agents).length === 0 ? (
              <p className="text-xs opacity-30 italic">Awaiting Agent discovery synchronization...</p>
           ) : (
              Object.values(agents).map(agent => (
                 <div key={agent.agent_id} className="flex justify-between items-center bg-white/5 border-l-2 border-bronze p-3">
                    <div>
                       <span className="text-xs font-black uppercase text-bronze mr-4">{agent.metadata.clusterName || 'UNKNOWN'}</span>
                       <CopyText text={agent.agent_id} />
                    </div>
                    <div className="flex gap-8 text-[10px] font-black uppercase">
                       <span className="opacity-50">Report Interval: <span className="text-main">30s</span></span>
                       <span className="opacity-50">API Version: <span className="text-main">v1.2.0</span></span>
                    </div>
                 </div>
              ))
           )}
        </div>
      </div>

      <footer style={{ marginTop: 'auto', padding: '1rem 2.5rem', borderTop: '1px solid rgba(176, 141, 87, 0.1)', opacity: '0.3', fontSize: '9px', fontWeight: 'bold', display: 'flex', justifyContent: 'flex-end', textTransform: 'uppercase', letterSpacing: '1px' }}>
          <div>© Chariot // Fabian Kamleitner</div>
      </footer>
    </div>
  );
}
