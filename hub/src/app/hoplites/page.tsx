'use client';

import React, { useState, useEffect } from 'react';
import { useTelemetry } from '@/components/TelemetryContext';
import { TerminalConsole } from '@/components/TerminalConsole';

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

// --- Log Terminal Modal ---
const LogTerminal = ({ gsName, onClose }: { gsName: string; onClose: () => void }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);
  const logEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    
    const readLogs = async () => {
      try {
        const response = await fetch(`/api/v1/hoplites/${gsName}/logs`);
        if (!isMounted) return;
        setIsConnecting(false);
        
        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done || !isMounted) break;
          const text = decoder.decode(value);
          setLogs(prev => [...prev, ...text.split('\n').filter(l => l.trim())]);
        }
      } catch (e) {
        if (isMounted) setLogs(prev => [...prev, `[ERROR] Link Failure: Unable to establish telemetry stream.`]);
      }
    };

    readLogs();

    return () => {
      isMounted = false;
    };
  }, [gsName]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: '100%', maxWidth: '950px', height: '80vh', backgroundColor: '#0a0a0a', border: '1px solid var(--accent-bronze)', display: 'flex', flexDirection: 'column', boxShadow: '0 0 60px rgba(0,0,0,1)' }}>
        <div style={{ padding: '0.85rem 1.5rem', borderBottom: '1px solid var(--accent-bronze-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #1a1a1a, #0a0a0a)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
             <div style={{ width: '8px', height: '8px', backgroundColor: isConnecting ? '#9b111e' : '#2ecc71', borderRadius: '50%', boxShadow: isConnecting ? 'none' : '0 0 10px #2ecc71' }}></div>
             <span style={{ fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '2px', color: 'var(--accent-bronze)', textTransform: 'uppercase' }}>
               Live Tactical Stream // {gsName}
             </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--accent-bronze)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}>&times;</button>
        </div>
        <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', fontFamily: '"Fira Code", monospace', fontSize: '0.85rem', color: '#d4d4d4', lineHeight: '1.6' }}>
          {isConnecting && (
            <div style={{ color: 'var(--accent-bronze)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <span className="animate-pulse">Attempting to establish secure handshake with Legionary Agent...</span>
            </div>
          )}
          {logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '4px', display: 'flex', gap: '12px' }}>
              <span style={{ color: 'var(--accent-bronze-dark)', fontSize: '0.7rem', minWidth: '40px' }}>{i.toString().padStart(4, '0')}</span>
              <span style={{ color: log.includes('ERROR') ? 'var(--accent-red)' : '#e0e0e0' }}>{log}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
        <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid #222', background: '#0a0a0a', display: 'flex', justifyContent: 'flex-end' }}>
           <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Stream Status: {isConnecting ? 'Connecting' : 'Active'}</span>
        </div>
      </div>
    </div>
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
  const [activeLogGs, setActiveLogGs] = useState<string | null>(null);
  const [activeTerminalGs, setActiveTerminalGs] = useState<string | null>(null);

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
      clusterName: (activeAgent.metadata && activeAgent.metadata.clusterName) || activeAgent.agent_id,
      usage: { cpu: 'N/A', memory: 'N/A', storage: 'N/A' },
      state: fleet.allocatedReplicas > 0 ? 'Allocated' : 'Ready'
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
        usage: server.usage || { cpu: '...', memory: '...', storage: '...' },
        agentId: activeAgent.agent_id,
        clusterName: (activeAgent.metadata && activeAgent.metadata.clusterName) || activeAgent.agent_id
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
            <label htmlFor="agent-select" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Target Legion:
            </label>
            <select
              id="agent-select"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--accent-bronze)', border: '1px solid var(--accent-bronze-dark)', padding: '0.5rem 1rem', fontFamily: 'Georgia, serif', fontSize: '1rem', textTransform: 'uppercase', outline: 'none', cursor: 'pointer' }}
              value={activeAgentId || ''}
              onChange={(e) => setActiveAgentId(e.target.value)}
            >
              {Object.values(agents).length === 0 ? (
                <option disabled>No Legions Discovered</option>
              ) : (
                Object.values(agents).map(a => (
                  <option key={a.agent_id} value={a.agent_id}>
                    {(a.metadata && a.metadata.clusterName) || a.agent_id}
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
            {activeAgent ? `Tactical units under Legion ${(activeAgent.metadata && activeAgent.metadata.clusterName) || activeAgent.agent_id}` : 'Handshake Pending'}
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
                <th style={{ textAlign: 'center' }}>CPU</th>
                <th style={{ textAlign: 'center' }}>RAM</th>
                <th style={{ textAlign: 'center' }}>DISK</th>
                <th>Actions</th>
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
                    <td style={{ textAlign: 'center' }}>
                       <span style={{ fontSize: '0.8rem', color: 'var(--accent-bronze)', fontFamily: 'monospace' }}>
                          {h.usage?.cpu || '0m'}
                       </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                       <span style={{ fontSize: '0.8rem', color: 'var(--accent-bronze)', fontFamily: 'monospace' }}>
                          {h.usage?.memory || '0Mi'}
                       </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                       <span style={{ fontSize: '0.8rem', color: 'var(--accent-bronze)', fontFamily: 'monospace' }}>
                          {h.usage?.storage || 'N/A'}
                       </span>
                    </td>
                    <td>
                       <div className="flex gap-2 justify-center">
                        <button 
                          onClick={() => setActiveLogGs(h.name)}
                          style={{ background: 'none', border: '1px solid rgba(176, 141, 87, 0.3)', color: 'var(--accent-bronze)', padding: '4px 8px', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-bronze)')}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(176, 141, 87, 0.3)')}
                        >
                          Logs
                        </button>
                        <button 
                          onClick={() => setActiveTerminalGs(h.name)}
                          disabled={h.state !== 'Allocated' && h.state !== 'Ready'}
                          style={{ 
                            background: 'none', 
                            border: '1px solid rgba(176, 141, 87, 0.3)', 
                            color: 'var(--accent-bronze)', 
                            padding: '4px 8px', 
                            fontSize: '10px', 
                            textTransform: 'uppercase', 
                            cursor: (h.state === 'Allocated' || h.state === 'Ready') ? 'pointer' : 'not-allowed',
                            opacity: (h.state === 'Allocated' || h.state === 'Ready') ? 1 : 0.4
                          }}
                          onMouseEnter={(e) => {
                            if (h.state === 'Allocated' || h.state === 'Ready') e.currentTarget.style.borderColor = 'var(--accent-bronze)';
                          }}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(176, 141, 87, 0.3)')}
                        >
                          Console
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Log Modal */}
      {activeLogGs && (
        <LogTerminal gsName={activeLogGs} onClose={() => setActiveLogGs(null)} />
      )}

      {/* Terminal Modal */}
      {activeTerminalGs && activeAgent && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: '100%', maxWidth: '1000px', height: '80vh', backgroundColor: '#0a0a0a', border: '1px solid var(--accent-bronze)', display: 'flex', flexDirection: 'column', boxShadow: '0 0 60px rgba(0,0,0,1)' }}>
            <div style={{ padding: '0.85rem 1.5rem', borderBottom: '1px solid var(--accent-bronze-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #1a1a1a, #0a0a0a)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '2px', color: 'var(--accent-bronze)', textTransform: 'uppercase' }}>
                  Interactive Terminal // {activeTerminalGs}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                  Connected via Legion Agent // {activeAgent.metadata?.agentUrl || 'LOCAL_BRIDGE'}
                </span>
              </div>
              <button 
                onClick={() => setActiveTerminalGs(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--accent-bronze)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
               <TerminalConsole 
                 podName={activeTerminalGs} 
                 namespace="chariot-hoplites" 
                 agentUrl={activeAgent.metadata?.agentUrl || 'http://localhost:3001'} 
                 onClose={() => setActiveTerminalGs(null)}
               />
            </div>
          </div>
        </div>
      )}
      {/* Deployment Modal Overlay */}
      {isDeployModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--accent-bronze-dark)', padding: '2rem', width: '450px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
             <h3 style={{ textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.2rem', borderBottom: '1px solid var(--accent-bronze-dark)', paddingBottom: '0.5rem' }}>
                Tactical Deployment
             </h3>
             
             <div className="mb-6">
                <label htmlFor="formation-select" style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Select Formation Template:</label>
                <select 
                  id="formation-select"
                  style={{ width: '100%', backgroundColor: 'var(--bg-input)', color: 'var(--accent-bronze)', border: '1px solid var(--accent-bronze-dark)', padding: '0.75rem', outline: 'none' }}
                  value={selectedFormationId}
                  onChange={(e) => setSelectedFormationId(e.target.value)}
                >
                  {formations.map(f => (
                    <option key={f.id} value={f.id}>{f.name} (v{f.version})</option>
                  ))}
                </select>
             </div>

             {/* Tactical Specification Visibility */}
             {selectedFormationId && formations.find(f => f.id === selectedFormationId) && (
               <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--accent-bronze-dark)', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
                  <div style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.7rem', marginBottom: '0.75rem', fontWeight: 'bold', letterSpacing: '1px' }}>
                    Tactical Specification:
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span style={{ color: 'var(--text-muted)' }}>CPU Requirement:</span>
                    <span style={{ color: 'var(--accent-bronze)', fontWeight: 'bold' }}>{formations.find(f => f.id === selectedFormationId).cpu}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span style={{ color: 'var(--text-muted)' }}>Memory Requirement:</span>
                    <span style={{ color: 'var(--accent-bronze)', fontWeight: 'bold' }}>{formations.find(f => f.id === selectedFormationId).memory}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: 'var(--text-muted)' }}>Storage Allocation:</span>
                    <span style={{ color: 'var(--accent-bronze)', fontWeight: 'bold' }}>{formations.find(f => f.id === selectedFormationId).storage}</span>
                  </div>
               </div>
             )}

             <div className="flex flex-col gap-4">
                {deployError && (
                  <div style={{ color: 'var(--accent-red)', fontSize: '0.8rem', backgroundColor: 'rgba(155, 17, 30, 0.1)', padding: '0.5rem', border: '1px solid var(--accent-red)' }}>
                      ERROR: {deployError}
                  </div>
                )}
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '1rem' }}>
                  Deploying to Legion <span style={{ color: 'var(--accent-bronze)' }}>{(activeAgent?.metadata && activeAgent.metadata.clusterName) || activeAgentId}</span>. This unit will be provisioned immediately.
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
