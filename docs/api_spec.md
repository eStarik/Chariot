# Chariot API Specifications v1

## 🛡️ Authentication Protocol (Shared Secret & Agent Token)

All initial communication between the **Agent (Spoke)** and the **Hub (Coordinator)** is secured using a `SHARED_SECRET`.

1.  **Shared Secret**: Used for the *initial* registration only.
2.  **Agent Token**: A unique, high-entropy token issued by the Hub upon first registration.
3.  **Persistent ID**: The `AGENT_ID` provided by the Hub must be stored by the Agent.
4.  **Impersonation Protection**: All subsequent calls (re-connection or reporting) MUST include the `AGENT_TOKEN` matching the `AGENT_ID`.

---

## 🛰️ Chariot-Agent -> Hub (Egress)

### 🤝 1. Agent Registration
**Endpoint**: `POST /api/v1/register`
**Purpose**: Registers the agent and obtains a unique identifier and token.

**Request Body (Initial)**:
```json
{
  "secret": "string",
  "metadata": {
    "cluster_name": "string",
    "region": "string"
  }
}
```

**Request Body (Re-connection)**:
```json
{
  "agent_id": "uuid-v4",
  "secret": "string", 
  "metadata": { "cluster_name": "string" }
}
```

**Response (201 Created)**:
```json
{
  "agent_id": "uuid-v4",
  "agent_token": "secure-random-token",
  "expires_in": 3600
}
```

### 📊 2. Resource Reporting
**Endpoint**: `POST /api/v1/report`
**Headers**:
- `X-Agent-ID`: `uuid-v4`
- `X-Agent-Token`: `secure-random-token`

**Request Body**:
```json
{
  "timestamp": "iso8601",
  "resources": {
    "cpu_total": "number",
    "cpu_used": "number",
    "ram_total": "number",
    "ram_used": "number",
    "storage_total": "number",
    "storage_used": "number"
  },
  "namespaces": [
    {
      "name": "string",
      "fleet_count": 5,
      "gameserver_count": 25
    }
  ]
}
```

---

## 🛠️ Hub -> Chariot-Agent (Ingress)

### 📈 3. Resource Visualization
**Purpose**: The Hub queries the Agent for real-time fleet details.

**Endpoint (Agent-side)**: `GET /api/v1/agent-status`
**Auth Required**: `X-Agent-Token` header.

**Output**: JSON list of Agones Fleets, GameServers, and FleetAutoscalers found in the scoped namespaces.
