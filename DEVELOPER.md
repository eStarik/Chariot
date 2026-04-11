# Chariot Agones - The Imperial Archive

Welcome to the central technical documentation for Chariot Agones. This archive contains the essential information required to deploy, develop, and expand the coordination layer of your game server infrastructure.

---

## 1. Installation Guide
Chariot is deployed as a two-part system: the **Hub** (Coordinator) and the **Agent** (Legion Monitor).

### Prerequisites
- Kubernetes Cluster (v1.24+)
- Helm 3.x
- [Optional] Agones CRDs installed in the target cluster.

### Deploying the Hub
The Hub is the central brain and dashboard. 
```bash
helm upgrade --install chariot-hub ./charts/chariot-hub \
  --set global.domain="yourdomain.com" \
  --set auth.secret="secure-random-string" \
  --set env.sharedSecret="handshake-secret-key"
```

### Deploying the Agent
The Agent is deployed once per cluster you wish to controll.
```bash
helm upgrade --install chariot-agent ./charts/chariot-agent \
  --set env.hubUrl="https://chariot.yourdomain.com" \
  --set env.sharedSecret="handshake-secret-key"
```

---

## 2. Development Setup
To contribute to the architectural growth of Chariot, follow these steps.

### Local Cluster Orchestration
1. **Initialize the Hub**:
   ```bash
   cd hub
   npm install
   npm run dev
   ```
2. **Initialize the Agent**:
   ```bash
   cd agent
   npm install
   npm run build # The agent runs as a singleton process
   ```

### Mocking the Environment
Use `values.local.yaml` in the Helm charts to override production settings with local cluster paths.

---

## 3. Database Lifecycle & Migrations
Chariot utilizes **Drizzle ORM** with **PostgreSQL** for its persistent memory.

### Schema Updates
If you modify `hub/src/lib/db/schema.ts`:
1. **Generate Migration**:
   ```bash
   cd hub
   npx drizzle-kit generate
   ```
2. **Apply to Local/Dev DB**:
   ```bash
   npx drizzle-kit push # Use development push for rapid iteration
   ```

### Data Seeding
The system automatically executes `seedDatabase()` on startup if the database is empty. You can manually re-seed using:
```bash
cd hub
npm run seed
```
This provisions the default **Imperial Commander** (`admin@chariot.hub` / `admin`) and baseline configurations.

---

## 4. Expansion with Agents (Multi-Cluster)
Scaling Chariot to monitor multiple clusters is inherently supported by the registration protocol.

1. **Fingerprinting**: Every Agent automatically generates a unique `fingerprint` based on its cluster's signature.
2. **Provisioning**: To add a new cluster, simply deploy a new `chariot-agent` release pointing to the same Hub.
3. **Identity Protection**: Upon first contact, the Hub grants a persistent UUID. The Agent saves this in a Kubernetes Secret (`chariot-agent-identity`) within its own namespace to survive restarts.

---

## 5. Function-Level Documentation
Developers should refer to the **TSDoc** comments in the following files for granular logic:
- `hub/src/lib/registry.ts`: Agent lifecycle and soft-delete logic.
- `hub/src/lib/auth.ts`: Multi-factor registration handshake.
- `agent/logic.ts`: Kubernetes Secret-backed identity persistence.

---
