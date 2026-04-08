  ____ _                _       _   
 / ___| |__   __ _ _ __(_) ___ | |_ 
| |   | '_ \ / _` | '__| |/ _ \| __|
| |___| | | | (_| | |  | | (_) | |_ 
 \____|_| |_|\__,_|_|  |_|\___/ \__|

=========================================
The command center for your Agones fleets
=========================================

Chariot is a lightweight, high-performance web interface designed for managing and monitoring [Agones](https://agones.dev/) game server fleets on Kubernetes. 

Currently in early development, the goal of this project is to provide game developers and server administrators with real-time orchestration and visibility into their infrastructure without the need to rely solely on `kubectl`.

### [+] Planned Features

* **Fleet Visualization:** View the real-time status of your Agones Fleets, FleetAutoscalers, and GameServers.
* **Lifecycle Management:** Easily monitor allocation states, health checks, and server shutdowns.
* **Lightweight Footprint:** A clean, focused UI that runs efficiently inside your existing Kubernetes cluster.

### [+] Local Development

For high-fidelity local testing within a Kubernetes cluster (Docker Desktop, KinD, etc.), use the categorical overrides found in `values.local.yaml`.

```bash
# 1. Deploy the Hub with local overrides
helm install chariot-hub ./charts/chariot-hub -f ./charts/chariot-hub/values.local.yaml

# 2. Deploy the Agent monitor to your Agones cluster
helm install chariot-agent ./charts/chariot-agent -f ./charts/chariot-agent/values.local.yaml
```

Refer to the [Architecture Documentation](./docs/ARCHITECTURE.md) for detailed coordination of the security handshake and telemetry hierarchy.

### [+] License & Commercial Use

Chariot is source-available and dual-licensed to support both the community and the ongoing development of the project.

**> For Individuals and Hobbyists**
This project is licensed under the **Polyform Noncommercial 1.0.0** license. You are free to read, modify, and run this software for personal, educational, and non-commercial weekend projects. See the `LICENSE` file for details.

**> For Professional and Commercial Use**
If you intend to use Chariot in a corporate environment, at a game studio, or for any project intended for commercial advantage or monetary compensation, you must obtain a commercial license. 

To purchase a commercial license, please contact: **fkamleit@gmail.com**

---
// Built for the multiplayer community.