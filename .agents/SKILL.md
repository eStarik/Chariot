# Agones Management Skill (Chariot)

This skill provides instructions for developing and maintaining the Chariot Agones UI.

## Overview
Chariot is a Next.js application that interacts with Agones CRDs (`GameServer`, `Fleet`, etc.) via the official JavaScript Kubernetes client.

## Tech Stack
- **Framework**: Next.js (App Router)
- **K8s Client**: `@kubernetes/client-node`
- **Styling**: Vanilla CSS (CSS Variables + modern UI patterns)
- **Icons**: `lucide-react`

## Core Concepts

### 1. Agones CRD Interaction
Always use the `CustomObjectsApi` from `@kubernetes/client-node`.
- Group: `agones.dev`
- Version: `v1`
- Plurals: `gameservers`, `fleets`, `fleetautoscalers`

Example listing fleets:
```typescript
const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi);
const response = await k8sApi.listClusterCustomObject('agones.dev', 'v1', 'fleets');
```

### 2. Design Language
Maintain a "Premium Dark" aesthetic.
- Background: `hsl(230, 20%, 10%)`
- Primary Accent: `hsl(280, 70%, 60%)` (Agones Purple)
- Success: `hsl(150, 60%, 50%)`
- Cards: Semi-transparent glassmorphism with `backdrop-filter: blur(10px)`.

### 3. File Structure
- `/src/lib/k8s/`: All Kubernetes/Agones interaction logic.
- `/src/components/ui/`: Presentation-only components using Vanilla CSS modules.
- `/src/app/api/`: Metadata-driven API endpoints.

## Agent Guidelines
1. **Never use TailwindCSS**. Use Vanilla CSS and CSS Variables.
2. **Handle Errors Gracefully**: Kubernetes API calls can fail or time out. Always wrap in try/catch and return user-friendly errors.
3. **Real-time First**: Prefer using `react-query` for data fetching to allow for easy implementation of polling or status synchronization.
