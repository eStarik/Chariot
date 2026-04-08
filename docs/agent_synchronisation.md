# Chariot Agones Architecture

This document describes the architectural coordinates and security handshakes governing the Chariot Agones agent federation.

## 1. Identity & Security (PKI-style Handshake)

Chariot employs a persistent, fingerprint-based identity system to ensures seamless Agent discovery and coordination.

1.  **Cluster Fingerprinting**: The Agent monitor definitively extracts the `kube-system` namespace UID to derive an immutable cluster signature.
2.  **Handshake Proclamation**: Upon first contact (or pod restart), the Agent presents its `fingerprint` and a `sharedSecret` to the Hub's `/api/v1/register` endpoint.
3.  **Persistent Handshake**: The Hub coordinates issue a unique **Agent ID** and **Agent Token** (acting as a session certificate). 
4.  **Secret Persistence**: The Agent definitively saves these coordinates into a namespaced **Kubernetes Secret** (`chariot-agent-identity`). This synchronizes identity across pod evictions and restarts without local volume dependencies.

## 2. Hierarchical Telemetry & Discoveries

The Agent monitor synchronizes cluster-wide Agones telemetry in a hierarchical coordinates system:

- **Level 1: Node Capacity**: Discovery of vCPU and Memory capacity vs. usage across all nodes.
- **Level 2: Agones Fleets**: Categorical summaries of `Ready` vs. `Allocated` replicas.
- **Level 3: GameServer Assets**: Individual discoverability of every **GameServer** instance, including its current state, address, and port.

## 3. Registry & Status Management

The Hub coordinates a state-aware registry to maintain a high-fidelity dashboard view:

- **Connected**: Legions are reporting heartbeat within a 5-minute window.
- **Disconnected (Soft-Disconnect)**: Legions that synchronized with the federation but have timed out. These are marked as "Disconnected" in the DB rather than deleted, allowing for record restoration once the Legion reports heartbeat again.
- **Stale Purge**: Categorical deletion only occurs for records that were created but never reported telemetry. Or when a Legion is explicitly deleted by the user. This marks the Legion as "Deleted" in the DB. The entry can be manually restored by the user.
