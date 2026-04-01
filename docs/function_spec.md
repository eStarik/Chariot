# Chariot Function Logic Specifications

This document defines the "Phase 0" design for every core function in Chariot.

---

## 🏗️ 1. Authentication & Registration (Revised)

### `validateRegistration(payload: any)`
**Location**: `hub/src/lib/auth.ts`
**Purpose**: Validates an agent's request to join and issues persistent credentials.

- **Input Parameters**:
  - `payload.secret` (String): The shared secret.
  - `payload.agent_id` (String | Optional): Existing ID for re-connection.
- **Process / Decision Flow**:
  1. Verify `secret` against `process.env.SHARED_SECRET`. If mismatch → **401 Unauthorized**.
  2. If `agent_id` is provided in the request:
     - Check if `agent_id` exists in the `Registry`.
     - Verify it matches the incoming `cluster_name` or other metadata.
     - Return the same `agent_id` and existing `agent_token`.
  3. If NO `agent_id` provided:
     - Generate new `UUIDv4` as `agent_id`.
     - Generate a high-entropy string as `agent_token`.
     - Save to `Registry` with metadata.
- **Expected Output**:
  - Success: `{ success: true, agent_id, agent_token }`
  - Failure: `{ success: false, error: "message" }`

---

### `registerWithHub()`
**Location**: `agent/logic.ts`
**Purpose**: Handles the agent-side "Persistent Join" logic.

- **Process / Decision Flow**:
  1. Load `agent_id` and `agent_token` from local storage (e.g., `agent.config.json`).
  2. If credentials exist:
     - Attempt registration with `{ agent_id, secret, metadata }`.
  3. If NO credentials exist:
     - Attempt registration with `{ secret, metadata }`.
  4. On Success (201):
     - Save returned `agent_id` and `agent_token` to `agent.config.json`.
  5. On Failure:
     - Enter retry loop with exponential backoff.
- **Expected Output**:
  - Success: `{ success: true, agentId, agentToken }`.

---

## 🛰️ 2. Status Reporting (Auth Required)

### `pushReportToHub(agentId, agentToken, reportData)`
**Location**: `agent/reporter.ts`
**Purpose**: Pushes metrics to Hub with secure authentication.

- **Process**:
  1. Construct POST to Hub `/api/v1/report`.
  2. Include `X-Agent-ID` and `X-Agent-Token` headers.
  3. If Hub returns 401 (Invalid Token) → Re-trigger `registerWithHub()`.
