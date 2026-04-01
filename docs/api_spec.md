# Chariot API Specifications v1

## 🛡️ Security Architecture

State-management between **Spoke Agents** and the **HUB Coordinator** utilizes a two-tier authentication handshake.

1.  **Provisioning Phase**: Initial handshake requires a `SHARED_SECRET` (symmetric).
2.  **Operational Phase**: All subsequent telemetry is authorized via a high-entropy `AGENT_TOKEN` issued during provisioning.
3.  **Identity Persistence**: Agents MUST persist the `AGENT_ID` and `AGENT_TOKEN` locally to support session resumption across restarts.

---

## 🛰️ Agent Telemetry (Egress)

### 🤝 Identity Handshake
**Endpoint**: `POST /api/v1/register`  
**Description**: Provision or resume an agent identity.

**Handshake Payload**:
```json
{
  "secret": "string",
  "agent_id": "uuid-v4 (optional)",
  "metadata": {
    "clusterName": "string",
    "region": "string"
  }
}
```

**HUB Response (201 Created)**:
```json
{
  "agent_id": "uuid-v4",
  "agent_token": "sha256-string",
  "status": "registered"
}
```

### 📊 Telemetry Ingestion
**Endpoint**: `POST /api/v1/report`  
**Permissions**: `X-Agent-ID` and `X-Agent-Token` headers required.

**Telemetry Payload**:
```json
{
  "resources": {
    "cpu": { "capacity": "string", "usage": "string" },
    "memory": { "capacity": "string", "usage": "string" }
  },
  "fleets": [
    {
      "name": "string",
      "replicas": 10,
      "readyReplicas": 8,
      "allocatedReplicas": 2
    }
  ]
}
```

---

## 💻 Dashboard Integration (Ingress)

### 📈 Live Event Stream
**Endpoint**: `GET /api/v1/events`  
**Protocol**: Server-Sent Events (SSE)

**Event Payload**:
```json
{
  "type": "CLUSTER_UPDATE",
  "agentId": "uuid-v4",
  "timestamp": 1711974000000,
  "payload": { ...ClusterReport }
}
```
