'use client';

import React from 'react';
import { useTelemetry } from '../../components/TelemetryContext';

// --- Legion Details Components ---

const Gauge = ({ label, used, total, unit, colorClass }: { label: string; used: number; total: number; unit: string; colorClass: string }) => {
  const percent = Math.min((used / total) * 100, 100);
  return (
    <div className="mb-4">
      <div className="flex justify-between text-[10px] mb-1 uppercase tracking-widest font-bold opacity-70">
        <span>{label}</span>
        <span>{used.toFixed(1)} / {total.toFixed(1)} {unit}</span>
      </div>
      <div className="h-1.5 w-full bg-black bg-opacity-40 overflow-hidden relative">
        <div className={`h-full transition-all duration-1000 ease-out ${colorClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const LegionCard = ({ agent }: { agent: any }) => {
  const isStale = agent.lastReportTimestamp ? (Date.now() - agent.lastReportTimestamp > 45000) : true;
  const clusterName = agent.metadata.clusterName || 'UNKNOWN_NODE';

  const cpuUsed = parseFloat(agent.resources?.cpu.usage || '0');
  const cpuCap = parseFloat(agent.resources?.cpu.capacity || '1');
  const memUsed = parseFloat(agent.resources?.memory.usage || '0');
  const memCap = parseFloat(agent.resources?.memory.capacity || '1');

  return (
    <div className="formation-card p-6 border-bronze/30">
      <div className="flex justify-between items-start mb-6 pb-4 border-b border-white/5">
        <div>
          <h3 className="text-xl font-black uppercase text-bronze">{clusterName}</h3>
          <p className="text-[10px] font-mono opacity-40">{agent.agent_id}</p>
        </div>
        <span className={`badge ${isStale ? 'badge-combat' : 'badge-idle'}`}>
          {isStale ? 'STALE' : 'SECURED'}
        </span>
      </div>

      <div className="space-y-4 mb-8">
        <Gauge label="vCPU LOAD" used={cpuUsed} total={cpuCap} unit="CORES" colorClass="grad-bronze" />
        <Gauge label="MEM LOAD" used={memUsed} total={memCap} unit="GiB" colorClass="grad-bronze" />
      </div>

      <div className="section-header">
         <h4 className="text-[10px] font-black opacity-30">Discovered Fleets</h4>
         <span className="text-[10px] font-mono opacity-30">{agent.fleets?.length || 0} variants</span>
      </div>

      <div className="space-y-2">
        {!agent.fleets || agent.fleets.length === 0 ? (
          <p className="text-[10px] text-center italic opacity-30">No active fleets discovered.</p>
        ) : (
          agent.fleets.map((f: any) => (
            <div key={f.name} className="flex justify-between items-center bg-white/5 p-2 text-[11px] font-bold">
               <span>{f.name}</span>
               <span className="text-bronze">{f.allocatedReplicas} / {f.readyReplicas} ALLO</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- Legions View ---

export default function LegionsPage() {
  const { agents, isLoading } = useTelemetry();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="top-bar">
        <h2 style={{ fontSize: '1rem', color: 'var(--accent-bronze)' }}>Legions (Clusters)</h2>
        <div className="agent-status" style={{ fontSize: '0.8rem', color: 'var(--status-ready)' }}>
          Found {Object.keys(agents).length} active legions across the federation.
        </div>
      </div>

      <div className="content-body">
        <div className="formations-grid">
          {isLoading ? (
            <div className="col-span-full py-24 text-center">
               <div className="w-12 h-12 border-2 border-bronze border-t-transparent animate-spin mb-4 mx-auto" />
               <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30">Loading Legions</p>
            </div>
          ) : Object.values(agents).length === 0 ? (
            <div className="col-span-full py-32 border border-dashed border-grey-charcoal text-center">
              <p className="text-lg font-black uppercase tracking-[0.3em] opacity-10">No Legions Available</p>
            </div>
          ) : (
            Object.values(agents).map(agent => (
              <LegionCard key={agent.agent_id} agent={agent} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
