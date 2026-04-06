'use client';

import React from 'react';
import { useTelemetry } from '../components/TelemetryContext';
import Link from 'next/link';

// --- Overview Components ---

const LegionSnapshot = ({ agent }: { agent: any }) => {
  const isStale = agent.lastReportTimestamp ? (Date.now() - agent.lastReportTimestamp > 45000) : true;
  const clusterName = agent.metadata.clusterName || 'UNKNOWN_LEGION';
  const cpuUsed = parseFloat(agent.resources?.cpu.usage || '0');
  const cpuCap = parseFloat(agent.resources?.cpu.capacity || '1');
  const memCap = agent.resources?.memory.capacity || '0';
  const usedPercent = Math.round((cpuUsed / cpuCap) * 100) || 0;
  const totalHoplites = agent.fleets?.reduce((acc: number, f: any) => acc + f.readyReplicas, 0) || 0;

  return (
    <div className="formation-card" style={{ padding: '2.5rem 4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3.5rem' }}>
      {/* Legion Identity */}
      <div style={{ flex: '1.2', borderRight: '1px solid var(--chariot-glass-border)', paddingRight: '2rem' }}>
        <h4 style={{ color: 'var(--accent-bronze)', fontSize: '1.2rem', marginBottom: '0.2rem' }}>{clusterName}</h4>
        <p className="text-muted font-mono" style={{ fontSize: '10px', opacity: 0.5 }}>{agent.agent_id}</p>
      </div>

      {/* Max Resources Section */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div className="text-[10px] uppercase opacity-40 font-bold tracking-widest">Max Resources</div>
        <div className="text-sm font-mono text-bronze">{cpuCap} Cores // {memCap}</div>
      </div>

      {/* Resource Flow / Used % Section */}
      <div style={{ flex: '1.8' }}>
        <div className="flex justify-between w-full text-[10px] mb-2 opacity-50 uppercase tracking-widest font-bold">
          <span>Current Used Percent</span>
          <span className="text-bronze">{usedPercent}%</span>
        </div>
        <div className="h-1.5 w-full bg-black bg-opacity-40 rounded overflow-hidden">
          <div className="h-full grad-bronze" style={{ width: `${Math.min(usedPercent, 100)}%`, transition: 'width 1s ease-out' }} />
        </div>
      </div>

      {/* Deployed Hoplites Section */}
      <div style={{ flex: '1', textAlign: 'center', borderLeft: '1px solid var(--chariot-glass-border)', borderRight: '1px solid var(--chariot-glass-border)' }}>
        <div className="text-[10px] uppercase opacity-40 font-bold mb-1 tracking-widest">Deployed Hoplites</div>
        <div className="text-3xl font-black text-bronze">{totalHoplites}</div>
      </div>

      {/* Health Status Flow Element */}
      <div style={{ flex: '0.8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div className="text-[10px] uppercase opacity-40 font-bold tracking-widest">Health</div>
        <div 
          className={`w-3 h-3 ${isStale ? 'bg-red animate-pulse' : 'bg-bronze'}`} 
          style={{ 
            borderRadius: '50%', 
            boxShadow: isStale ? '0 0 10px red' : '0 0 10px var(--accent-bronze)',
            transition: 'all 0.5s'
          }} 
        />
      </div>
    </div>
  );
};

// --- Command Center Overview ---

export default function Overview() {
  const { agents, isLoading } = useTelemetry();

  const totalCores = Object.values(agents).reduce((acc, a) => acc + parseFloat(a.resources?.cpu.capacity || '0'), 0);
  const totalHoplites = Object.values(agents).reduce((acc, a) => 
    acc + (a.fleets?.reduce((facc, f) => facc + f.readyReplicas, 0) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="top-bar">
        <h2 style={{ fontSize: '1rem', color: 'var(--accent-bronze)' }}>Command Center Overview</h2>
        <div className="agent-status" style={{ fontSize: '0.8rem', color: 'var(--status-ready)' }}>
          System Operational // Aggregated Multi-Cluster View
        </div>
      </div>

      <div className="content-body">
        {/* Global Statistics Summary */}
        <section className="grid grid-cols-4 gap-4 mb-12">
          <div className="formation-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div className="text-[10px] uppercase opacity-40 mb-2">Total Legions</div>
            <div className="text-3xl font-black text-bronze">{Object.keys(agents).length}</div>
          </div>
          <div className="formation-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div className="text-[10px] uppercase opacity-40 mb-2">Total vCPU Cores</div>
            <div className="text-3xl font-black text-bronze">{totalCores.toFixed(1)}</div>
          </div>
          <div className="formation-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div className="text-[10px] uppercase opacity-40 mb-2">Deployed Hoplites</div>
            <div className="text-3xl font-black text-bronze">{totalHoplites}</div>
          </div>
          <div className="formation-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div className="text-[10px] uppercase opacity-40 mb-2">System Health</div>
            <div className="text-3xl font-black text-bronze">OPTIMAL</div>
          </div>
        </section>

        <div className="section-header">
          <h2>Legion Snapshots</h2>
          <span className="text-muted" style={{ fontSize: '0.9rem' }}>Live Orchestration Status</span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 opacity-50">
            <div className="w-12 h-12 border-2 border-bronze border-t-transparent animate-spin mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.5em]">Synchronizing Registry</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {Object.values(agents).length === 0 ? (
              <div className="w-full py-12 border border-dashed border-grey-charcoal text-center">
                <p className="text-lg font-black uppercase tracking-[0.3em] opacity-10">
                  Waiting for Legion Discovery...
                </p>
              </div>
            ) : (
              Object.values(agents).map(agent => (
                <LegionSnapshot key={agent.agent_id} agent={agent} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
