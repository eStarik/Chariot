# Chariot Development Task List

## 🏗️ Phase 1: Specifications & Documentation
- [x] Initial Hub & Agent Architecture Plan
- [/] API & Function Specifications (`docs/api_spec.md`)
- [ ] Resource Quota Preview Logic Design

## 🧪 Phase 2: Hub - Agent Connection (TDD)
### Documentation
- [ ] Document `POST /api/v1/register` (Hub-side)
- [ ] Document `POST /api/v1/report` (Agent-side)
### Tests
- [x] Write integration test: "Agent can successfully register with shared secret"
- [x] Write integration test: "Agent fails to register with wrong secret"
- [x] Write integration test: "Agent sends cluster capacity report"
### Implementation
- [x] Implement `Chariot-Agent` registration loop
- [x] Implement `Chariot-Hub` registration endpoint & registry

## 🎮 Phase 3: Agones Management (TDD)
- [ ] Write tests for Fleet/GameServer visualization
- [ ] Implement Real-time Watchers (SSE)
- [ ] Implement "Smart Deploy" form with Quota Preview

## 🛡️ Phase 4: Security & Multi-tenancy
- [ ] OIDC / Basic Auth toggle implementation (Configurable via ConfigMap)
- [ ] Namespace-scoped visibility for customers
