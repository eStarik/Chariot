'use client';

import React, { useState, useEffect } from 'react';
import { useTelemetry } from '@/components/TelemetryContext';

// --- Click-to-Copy Component ---
const CopyText = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span 
      onClick={handleCopy}
      style={{ 
        color: 'var(--status-combat)', 
        fontFamily: 'monospace', 
        fontSize: '0.8rem', 
        cursor: 'pointer', 
        fontWeight: 'bold',
        transition: 'opacity 0.2s',
        borderBottom: '1px dashed rgba(155, 17, 30, 0.3)',
        display: 'inline-block'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
    >
      {copied ? '[ SECURED ]' : text}
    </span>
  );
};

// --- Hoplites View ---

export default function HoplitesPage() {
  const { agents, activeAgentId, setActiveAgentId, isLoading } = useTelemetry();
  const [filter, setFilter] = useState('');
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [formations, setFormations] = useState<any[]>([]);
  const [selectedFormationId, setSelectedFormationId] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState('');
  const [deploySuccess, setDeploySuccess] = useState('');

  // Auto-clear success message
  useEffect(() => {
    if (deploySuccess) {
      const timer = setTimeout(() => setDeploySuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [deploySuccess]);

  // Fetch formations for the deploy modal
  useEffect(() => {
    async function fetchFormations() {
      try {
        const res = await fetch('/api/v1/formations');
        const data = await res.json();
        if (data.success) {
          setFormations(data.formations);
          if (data.formations.length > 0) setSelectedFormationId(data.formations[0].id);
        }
      } catch (e) { /* silent */ }
    }
    fetchFormations();
  }, []);

  const handleDeploy = async () => {
    if (!activeAgentId || !selectedFormationId) return;

    setIsDeploying(true);
    setDeployError('');
    try {
      const res = await fetch('/api/v1/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: activeAgentId,
          formationId: selectedFormationId,
        }),
      });

      if (res.ok) {
        setIsDeployModalOpen(false);
        setDeploySuccess(`Tactical deployment of formation "${formations.find(f => f.id === selectedFormationId)?.name}" enqueued successfully.`);
      } else {
        const data = await res.json();
        setDeployError(data.error || 'Deployment failed');
      }
    } catch (e: any) {
      setDeployError(e.message);
    } finally {
      setIsDeploying(false);
    }
  };

  // 1. Contextualize to the ACTIVE LEGION ONLY (as per USER requirement)
  const activeAgent = activeAgentId ? agents[activeAgentId] : null;

  const currentHoplites = activeAgent ? [
    ...(activeAgent.fleets || []).map(fleet => ({
      ...fleet,
      id: fleet.name,
      type: 'FLEET',
      displayStatus: fleet.allocatedReplicas > 0 ? 'In Combat' : 'Standing By',
      statusClass: fleet.allocatedReplicas > 0 ? 'badge-combat' : 'badge-idle',
      performance: `${fleet.allocatedReplicas} / ${fleet.readyReplicas} ALLO`,
      agentId: activeAgent.agent_id,
      clusterName: activeAgent.metadata.clusterName || activeAgent.agent_id
    })),
    ...(activeAgent.servers || []).map(server => {
      const isProvisioning = server.state === 'Unhealthy' || server.state === 'Scheduled';
      return {
        ...server,
        id: server.name,
        type: 'SERVER',
        displayStatus: server.state === 'Allocated' ? 'In Combat' : isProvisioning ? 'Provisioning' : server.state,
        statusClass: server.state === 'Allocated' ? 'badge-combat' : server.state === 'Ready' ? 'badge-ready' : isProvisioning ? 'badge-idle' : 'badge-idle',
        performance: isProvisioning ? 'FETCHING ASSETS...' : (server.address ? `${server.address}:${server.port}` : 'CONNECTING...'),
        agentId: activeAgent.agent_id,
        clusterName: activeAgent.metadata.clusterName || activeAgent.agent_id
      };
    })
  ] : [];

  // optional text filtering on top of contextual legion filtering
  const filteredHoplites = currentHoplites.filter(h => 
    h.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="top-bar" style={{ padding: '0 2.5rem' }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Target Legion:
            </label>
            <select
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--accent-bronze)', border: '1px solid var(--accent-bronze-dark)', padding: '0.5rem 1rem', fontFamily: 'Georgia, serif', fontSize: '1rem', textTransform: 'uppercase', outline: 'none', cursor: 'pointer' }}
              value={activeAgentId || ''}
              onChange={(e) => setActiveAgentId(e.target.value)}
            >
              {Object.values(agents).length === 0 ? (
                <option disabled>No Legions Discovered</option>
              ) : (
                Object.values(agents).map(a => (
                  <option key={a.agent_id} value={a.agent_id}>
                    {a.metadata.clusterName || a.agent_id}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-4" style={{ marginLeft: 'auto' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Filter:
            </label>
            <input 
              type="text"
              className="bg-input border border-bronze/30 p-2 text-xs text-bronze uppercase tracking-widest outline-none focus:border-bronze"
              placeholder="Formation variant..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          <button
            onClick={() => setIsDeployModalOpen(true)}
            disabled={!activeAgentId}
            style={{ 
              backgroundColor: 'var(--accent-red)', 
              color: 'white', 
              border: 'none', 
              padding: '0.5rem 1.5rem', 
              fontSize: '0.75rem', 
              fontWeight: 'bold', 
              cursor: activeAgentId ? 'pointer' : 'not-allowed', 
              textTransform: 'uppercase', 
              letterSpacing: '1px',
              opacity: activeAgentId ? 1 : 0.5
            }}
          >
            Deploy New Hoplite
          </button>
        </div>
      </div>

      {deploySuccess && (
        <div style={{ 
          backgroundColor: 'rgba(34, 139, 34, 0.15)', 
          borderBottom: '1px solid var(--status-ready)', 
          padding: '0.75rem 2.5rem', 
          color: 'var(--status-ready)', 
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <span style={{ fontWeight: 'bold' }}>[ TACTICAL UPDATE ]</span> {deploySuccess}
        </div>
      )}

      <div className="content-body">
        <div className="section-header">
          <h2>Active Hoplites</h2>
          <span className="text-muted" style={{ fontSize: '0.9rem' }}>
            {activeAgent ? `Tactical units under Legion ${activeAgent.metadata.clusterName || activeAgent.agent_id}` : 'Handshake Pending'}
          </span>
        </div>

        {isLoading ? (
          <div className="py-24 text-center">
             <div className="w-12 h-12 border-2 border-bronze border-t-transparent animate-spin mb-4 mx-auto" />
             <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30">Loading Hoplites</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Hoplite ID</th>
                <th>Formation / Host</th>
                <th>Status</th>
                <th>Performance</th>
                <th>Uptime</th>
              </tr>
            </thead>
            <tbody>
              {!activeAgent ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', opacity: '0.3', fontStyle: 'italic' }}>
                    Select a Legion in the Sidebar to view tactical units.
                  </td>
                </tr>
              ) : filteredHoplites.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', opacity: '0.3', fontStyle: 'italic' }}>
                    No hoplites deployed by this legion.
                  </td>
                </tr>
              ) : (
                filteredHoplites.map((h, idx) => (
                  <tr key={`${h.agentId}-${h.id}`}>
                    <td>
                       <CopyText text={`h-lagn-${idx}${activeAgentId?.slice(0,2)}ae`} />
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.85rem' }}>
                       <span style={{ color: 'var(--text-main)', display: 'block', marginBottom: '2px' }}>{h.name}</span>
                       <span style={{ fontSize: '9px', opacity: 0.3 }}>{h.clusterName} // {h.type}</span>
                    </td>
                    <td>
                      <span className={`badge ${h.statusClass}`}>
                        {h.displayStatus}
                      </span>
                    </td>
                    <td className="font-mono text-bronze" style={{ fontSize: '0.8rem' }}>
                      {h.performance}
                    </td>
                    <td className="text-muted" style={{ fontSize: '0.8rem' }}>4h 12m</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
      {/* Deployment Modal Overlay */}
      {isDeployModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--accent-bronze-dark)', padding: '2rem', width: '450px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
             <h3 style={{ textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.2rem', borderBottom: '1px solid var(--accent-bronze-dark)', paddingBottom: '0.5rem' }}>
                Tactical Deployment
             </h3>
             
             <div className="mb-6">
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Select Formation Template:</label>
                <select 
                  style={{ width: '100%', backgroundColor: 'var(--bg-input)', color: 'var(--accent-bronze)', border: '1px solid var(--accent-bronze-dark)', padding: '0.75rem', outline: 'none' }}
                  value={selectedFormationId}
                  onChange={(e) => setSelectedFormationId(e.target.value)}
                >
                  {formations.map(f => (
                    <option key={f.id} value={f.id}>{f.name} (v{f.version})</option>
                  ))}
                </select>
             </div>

             <div className="flex flex-col gap-4">
                {deployError && (
                  <div style={{ color: 'var(--accent-red)', fontSize: '0.8rem', backgroundColor: 'rgba(155, 17, 30, 0.1)', padding: '0.5rem', border: '1px solid var(--accent-red)' }}>
                      ERROR: {deployError}
                  </div>
                )}
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '1rem' }}>
                  Deploying to Legion <span style={{ color: 'var(--accent-bronze)' }}>{activeAgent?.metadata?.clusterName || activeAgentId}</span>. This unit will be provisioned immediately.
                </p>

                <div className="flex gap-4">
                  <button 
                    onClick={handleDeploy}
                    disabled={isDeploying || !selectedFormationId}
                    style={{ flex: 1, backgroundColor: 'var(--accent-red)', color: 'white', border: 'none', padding: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', cursor: isDeploying ? 'wait' : 'pointer' }}
                  >
                    {isDeploying ? 'PROVISIONING...' : 'CONFIRM DEPLOYMENT'}
                  </button>
                  <button 
                    onClick={() => setIsDeployModalOpen(false)}
                    style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--text-muted)', padding: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    CANCEL
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
