# Chariot | Function Specification

This document defines the core logic and decision flows for the Chariot Hub and Agent components.

---

## Identity & Access Management

### `validateRegistration(handshakePayload)`
**Location**: `hub/src/lib/auth.ts`  
**Purpose**: Centralized validator for agent identity provisioning and session resumption.

- **Logical Flow**:
  1. Authorizes the incoming `secret` against `SHARED_SECRET`.
  2. **Session Resumption**: If an `agent_id` is present, it validates it against the active `Registry`.
  3. **Identity Provisioning**: For new agents, it generates a unique `agent_id` (UUIDv4) and a high-entropy `agent_token`.
  4. Persists the provisioned identity in the `Registry` and returns the credentials to the Agent.

---

## Telemetry Orchestration

### `registerWithHub(hubUrl, secret, existingId?)`
**Location**: `agent/logic.ts`  
**Purpose**: Orchestrates the Agent's lifecycle from initial boot to persistent identity.

- **Logical Flow**:
  1. Loads `AgentConfig` from local filesystem if available.
  2. Initiates the Hub handshake.
  3. On success: Persists the Hub-issued `agent_id` and `agent_token` locally to support seamless resumption on restart.
  4. On failure: Initiates a retry loop with exponential backoff.

### `pushReportToHub(hubUrl, agentId, token, telemetryPayload)`
**Location**: `agent/reporter.ts`  
**Purpose**: Securely transmits validated cluster metrics to the central Hub.

- **Logical Flow**:
  1. Compiles `ClusterReport` containing Agones fleet health and node metrics.
  2. Dispatches a POST request with `X-Agent-ID` and `X-Agent-Token` authorization headers.
  3. **Self-Healing**: If the Hub returns a `401 Unauthorized`, it signals the orchestration loop to re-initialize the registration handshake.

---

## Real-Time Broadcast

### `broadcastAgentUpdate(agentId, payload)`
**Location**: `hub/src/lib/events.ts`  
**Purpose**: Dispatches validated telemetry updates to all active UI consumers.

- **Logical Flow**:
  1. Wraps the telemetry payload in a structured `AgentUpdateEvent`.
  2. Iterates through all `activeListeners` (SSE controllers) and enqueues the serialized payload for immediate delivery.
