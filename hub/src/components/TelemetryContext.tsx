'use client';

import React, { createContext, useContext, useState, useEffect, useTransition } from 'react';

// --- Shared Telemetry Types ---

export interface ClusterResources {
  cpu: { capacity: string; usage: string };
  memory: { capacity: string; usage: string };
}

export interface FleetStatus {
  name: string;
  replicas: number;
  readyReplicas: number;
  allocatedReplicas: number;
}

export interface AgentRecord {
  agent_id: string;
  metadata: {
    clusterName?: string;
    [key: string]: any;
  };
  lastReportTimestamp?: number;
  resources?: ClusterResources;
  fleets?: FleetStatus[];
}

interface TelemetryContextType {
  agents: Record<string, AgentRecord>;
  activeAgentId: string | null;
  setActiveAgentId: (id: string | null) => void;
  isLoading: boolean;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Record<string, AgentRecord>>({});
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // 1. Initial State Hydration from Registry API
    async function hydrate() {
      try {
        const response = await fetch('/api/v1/registry');
        const result = await response.json();
        if (result.success) {
          startTransition(() => {
            setAgents(result.clusters);
            const firstId = Object.keys(result.clusters)[0];
            if (firstId && !activeAgentId) setActiveAgentId(firstId);
            setIsLoading(false);
          });
        }
      } catch (err) {
        console.error('[TelemetryProvider] Hydration failure:', err);
        setIsLoading(false);
      }
    }
    hydrate();

    // 2. Real-time Synchronization via Hub SSE Bus
    const eventSource = new EventSource('/api/v1/events');
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'CLUSTER_UPDATE') {
          setAgents(prev => {
            const next = {
              ...prev,
              [payload.agentId]: {
                ...prev[payload.agentId],
                ...payload.payload,
                agent_id: payload.agentId,
                lastReportTimestamp: payload.timestamp
              }
            };
            // Default to the first discovered agent if none selected
            if (!activeAgentId) setActiveAgentId(payload.agentId);
            return next;
          });
        }
      } catch (err) {
        // SSE heartbeats or parse errors ignored
      }
    };

    return () => eventSource.close();
  }, [activeAgentId]);

  return (
    <TelemetryContext.Provider value={{ agents, activeAgentId, setActiveAgentId, isLoading }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (context === undefined) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}
