# Project Brain V0.6.9 — PocketMonster ↔ VPS Connectivity Diagnosis

Status: **BLOCKED**  
Scope: browser → public ingress → VPS → authenticated Pirate gameplay

## What changed in the diagnosis

PocketMonster × Pirate Fruit code integration is already merged and its scoped release evidence remains valid. The unfinished part is a different layer: **the real browser-to-VPS runtime chain**.

The central mistake was treating several narrower SAT signals as if they proved the same thing:

```text
health/version SAT
+ client deploy SAT
+ Pocket × Pirate behavioral pair SAT
≠
real browser authenticated gameplay SAT
```

## Root-cause map

| Layer | Verdict | Diagnosis |
|---|---|---|
| Public client release | SAT | Pocket/Pirate merged release and static deployment are already proven. |
| Backend health/version | SAT (scoped) | Automation can reach the configured backend and validate health/version. |
| Client ↔ server Pirate API parity | **VIOL** | Public client expects the newer Pirate vitals/state-operation contract, while canonical reviewed VPS server source has not yet been promoted to the same contract line. |
| Server worker artifact parity | **VIOL** | The VPS release path is not guaranteed to package the same reviewed Pirate worker source as the shipped client/native release. |
| HTTPS/WSS ingress source of truth | **VIOL** | Public client pins one raw-IP origin while server operations have multiple possible ingress patterns. One canonical ingress is missing. |
| Worker binding on the running VPS | UNKNOWN | Source review cannot prove the running process has the reviewed worker executable/bundle bound and ready. |
| Authenticated browser E2E | UNKNOWN | No complete QA browser launch → REST/WSS → Pirate gameplay transaction has been captured. |

## Recommended target architecture

```text
Firebase launcher
      │
      │ Firebase ID token
      ▼
Stable HTTPS origin
(named tunnel / stable hostname)
      │
      ├── /api/*  ───────────────┐
      └── /ws/chat               │
                                 ▼
                         VPS loopback app
                         127.0.0.1:5000
                                 │
                                 ├── session/auth
                                 ├── canonical state
                                 ├── MariaDB
                                 └── reviewed Pirate worker
```

There should be **one** public origin. The application listener stays loopback-only. TLS/WSS termination and public exposure happen at the single ingress layer.

## Fix order

1. **P0 — Freeze one ingress**
   - Replace the raw-IP/quick-tunnel split with one stable hostname/tunnel origin.
   - The same origin must be used by runtime-config, CSP, Server.PublicUrl and reverse-proxy/tunnel config.
   - Do not expose a second public application port.

2. **P1 — Close server contract parity**
   - Promote the reviewed server implementation that supports:
     - `/api/pirate/state`
     - `/api/pirate/state/operation`
     - `/api/pirate/vitals/input`
     - `tradeQuote` / `trade`
     - current vitals/worker operations.
   - Add exact endpoint/operation contract tests to the canonical server branch.

3. **P2 — Pin one Pirate worker**
   - Build VPS `centralWorker.mjs` and economy engine from the exact reviewed Pirate source used by the release.
   - Record source SHA and SHA-256 in the server release manifest.
   - CI must reject a server artifact built from an older worker source.

4. **P3 — Runtime readiness**
   - Add a read-only worker readiness endpoint or health extension:
     - worker contract
     - ready/not-ready
     - source/version/hash
   - No credentials or machine paths in the response.
   - Deployment must prove HTTPS, CORS preflight and WSS from the public origin.

5. **P4 — Real browser QA**
   - Use one QA Firebase identity.
   - Verify in order:
     1. launch-ticket issue
     2. redirect/clean URL
     3. ticket redeem
     4. session established
     5. WSS authenticated
     6. Pirate state GET
     7. vitals input POST
     8. one idempotent Pirate operation
   - Record only redacted status/error codes and correlation IDs.

6. **P5 — Promotion**
   - Only after P0–P4 are SAT should the live-host integration be marked SAT.

## Why this has kept getting stuck

The game/domain integration, the web deployment, the backend health probe and the live authenticated VPS path were being treated as one problem. They are four different gates.

The most important change is therefore architectural: **one public ingress + one server contract line + one pinned worker artifact + one real browser acceptance test**.

## Privacy boundary

The VPS server repository is private. This public Project Brain record intentionally does not persist private repository names, paths, SHAs, credentials, machine paths or secret configuration. Private source was reviewed only to establish the high-level contract/parity diagnosis above.
