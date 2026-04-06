'use client';

import React, { useState } from 'react';
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
  const { agents, activeAgentId, isLoading } = useTelemetry();
  const [filter, setFilter] = useState('');

  // 1. Contextualize to the ACTIVE LEGION ONLY (as per USER requirement)
  const activeAgent = activeAgentId ? agents[activeAgentId] : null;

  const currentHoplites = activeAgent ? (activeAgent.fleets || []).map(fleet => ({
    ...fleet,
    agentId: activeAgent.agent_id,
    clusterName: activeAgent.metadata.clusterName || activeAgent.agent_id
  })) : [];

  // optional text filtering on top of contextual legion filtering
  const filteredHoplites = currentHoplites.filter(h => 
    h.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="top-bar">
        <div className="flex items-center gap-4">
          <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Local Filter:
          </label>
          <input 
            type="text"
            className="bg-input border border-bronze/30 p-2 text-xs text-bronze uppercase tracking-widest outline-none focus:border-bronze"
            placeholder="Formation variant..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="agent-status" style={{ fontSize: '0.8rem', color: 'var(--status-ready)' }}>
           {activeAgent ? `LEGION ${activeAgent.metadata.clusterName || activeAgent.agent_id} HOPLITES: ${currentHoplites.reduce((acc, h) => acc + h.readyReplicas, 0)}` : 'SELECT LEGION TO VIEW HOPLITES'}
        </div>
      </div>

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
                  <tr key={`${h.agentId}-${h.name}`}>
                    <td>
                       <CopyText text={`h-lagn-${idx}${activeAgentId?.slice(0,2)}ae`} />
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.85rem' }}>
                       <span style={{ color: 'var(--text-main)', display: 'block', marginBottom: '2px' }}>{h.name}</span>
                       <span style={{ fontSize: '9px', opacity: 0.3 }}>{h.clusterName} // ACTIVE</span>
                    </td>
                    <td>
                      <span className={`badge ${h.allocatedReplicas > 0 ? 'badge-combat' : 'badge-idle'}`}>
                        {h.allocatedReplicas > 0 ? 'In Combat' : 'Standing By'}
                      </span>
                    </td>
                    <td className="font-mono text-bronze" style={{ fontSize: '0.8rem' }}>
                      {h.allocatedReplicas} / {h.readyReplicas} ALLO
                    </td>
                    <td className="text-muted" style={{ fontSize: '0.8rem' }}>4h 12m</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
