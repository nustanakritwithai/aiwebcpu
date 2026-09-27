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
| Production host topology | **SAT (source-level)** | Firebase Hosting is the auth/launch-ticket launcher; the game/runtime is served from GitHub Pages; the Pages runtime connects to the configured API/WSS backend. |
| General-player admission | **VIOL** | Current rollout evidence is QA-scoped (single approved QA identity / one-user launch-ticket allowlist); it does not prove general-player admission. |
| Backend health/version | SAT (scoped) | Automation can reach the configured backend and validate health/version. |
| Client ↔ server Pirate API parity | **VIOL** | Public client expects the newer Pirate vitals/state-operation contract, while canonical reviewed VPS server source has not yet been promoted to the same contract line. |
| Server worker artifact parity | **VIOL** | The VPS release path is not guaranteed to package the same reviewed Pirate worker source as the shipped client/native release. |
| HTTPS/WSS ingress source of truth | **VIOL** | Public client pins one raw-IP origin while server operations have multiple possible ingress patterns. One canonical ingress is missing. |
| Worker binding on the running VPS | UNKNOWN | Source review cannot prove the running process has the reviewed worker executable/bundle bound and ready. |
| Authenticated browser E2E | UNKNOWN | No complete QA browser launch → REST/WSS → Pirate gameplay transaction has been captured. |

## Recommended target architecture

```text
Firebase launcher
(auth + launch-ticket only)
      │
      │ authenticated launch handoff
      ▼
GitHub Pages game/runtime
      │
      │ REST + WSS
      ▼
Stable backend HTTPS origin
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

There should be **one canonical public backend ingress** for API/WSS. Firebase Hosting and GitHub Pages currently have separate intentional frontend roles; P0 is not automatically a frontend-host consolidation task. The application listener stays loopback-only. TLS/WSS termination and public backend exposure happen at the single ingress layer.

## Fix order

1. **P0 — Freeze one backend ingress**
   - Keep the verified host roles explicit: Firebase = auth/launcher, GitHub Pages = game/runtime.
   - Replace the raw-IP/quick-tunnel backend split with one stable hostname/tunnel origin.
   - The same backend origin must be used by runtime-config, CSP connect-src, deployment workflow expectations, Server.PublicUrl and reverse-proxy/tunnel config.
   - Do not expose a second public application port.
   - Do not mistake the intentional Firebase → Pages frontend handoff for the backend-ingress defect.

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
   - Use the one approved QA Firebase identity; QA success proves only the QA-authenticated path, not general-player admission.
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
   - Only after P0–P4 are SAT should the QA-authenticated live-host path be eligible for SAT.
   - If general-player admission is still QA-limited, keep that scope VIOL/BLOCKED and do not describe the game as generally available multiplayer.

## Why this has kept getting stuck

The game/domain integration, the web deployment, the backend health probe and the live authenticated VPS path were being treated as one problem. They are four different gates.

The most important change is therefore architectural: **one public ingress + one server contract line + one pinned worker artifact + one real browser acceptance test**.

## Privacy boundary

The VPS server repository is private. This public Project Brain record intentionally does not persist private repository names, paths, SHAs, credentials, machine paths or secret configuration. Private source was reviewed only to establish the high-level contract/parity diagnosis above.


## Evidence refresh — 27 September 2026

A current source review clarified the production topology that the next agent should treat as established input rather than rediscover:

```text
https://pocketmonster-game.web.app/
    = Firebase Authentication + launch-ticket launcher
            │
            ▼
https://nustanakritwithai.github.io/PocketMonster/
    = game/runtime asset host
            │
            ├── HTTPS API → configured backend origin
            └── WSS       → configured backend /ws/chat
```

Deterministic public-source evidence:

- Firebase deployment verifies the exact matching GitHub Pages release before deploying the launcher.
- Firebase launcher generation sets the game asset base to GitHub Pages and enables launch-ticket mode.
- The Firebase live verifier explicitly requires the Firebase page to boot the launcher and **not** boot the V9 game locally.
- The launcher performs Firebase login, requests a launch ticket, then hands the browser to the returned game URL.
- The game-side launch bootstrap redeems the ticket, requires an active session and returns to the Firebase launcher when no valid session exists.
- The checked-in production runtime config still points API/WSS at the raw-IP backend origin.
- Production rollout material describes a **single approved QA identity / one-user launch-ticket allowlist**. This is evidence for a QA path only; it is not evidence that general-player admission is enabled.

### Updated verdict boundary

| Claim | Verdict |
|---|---|
| Firebase is the production auth/launcher host | SAT (source-level) |
| GitHub Pages is the production game/runtime host | SAT (source-level) |
| Firebase → Pages authenticated launch handoff exists in source | SAT (source-level) |
| One canonical stable backend HTTPS/WSS ingress | VIOL |
| General-player admission | VIOL |
| Live TLS/WSS from a real browser | UNKNOWN |
| Full authenticated Pirate gameplay E2E | UNKNOWN |

**Agent handoff:** start with P0 from `project-brain/agent-work.json`. Do not spend the first pass re-deriving the frontend topology. Inspect the actual private ingress/runtime through authenticated access, freeze one backend origin, then prove HTTPS and WSS deterministically. Keep private VPS metadata out of this public repository.
