# AI CPU Verified Agent Runtime - Pi Foundation V0.1

This module is the first executable control-plane foundation for combining:

- Pi-style agent/session patterns
- Jev AI CPU deterministic compute routing
- VIP verification (`SAT / VIOL / UNKNOWN`)
- VRR recovery candidate lineage
- evidence-gated memory proposals
- fail-closed execution policy

It does **not** fork or embed Pi yet. It defines a stable adapter boundary first so the rest of AI CPU does not depend directly on fast-changing Pi internals.

## Runtime flow

```text
Task
  -> Session Ledger / Candidate
  -> Skill metadata resolve
  -> Lazy skill load
  -> Compute route
  -> Policy Gate
  -> Executor
  -> Evidence Store
  -> VIP Verify
       SAT     -> eligible to prove/deliver
       VIOL    -> VRR recovery set
       UNKNOWN -> VRR/evidence acquisition
  -> Curated memory proposal only after SAT + provenance
```

## Implemented

### Session tree

`SessionLedger` stores parent-linked entries and reconstructs only the active branch. This mirrors the useful Pi session-tree property without binding AI CPU to Pi's internal type definitions.

### Pi adapter boundary

`pi-adapter.mjs` can:

- reconstruct an active branch from `id / parentId`
- normalize Pi-like session entries into Project Brain / AI CPU projection records
- keep `custom` records out of model context by default

### Lazy skill registry

The registry resolves only metadata first. A skill body is loaded only after the skill is selected.

### Compute ladder

Current deterministic policy:

```text
DETERMINISTIC
  -> LOCAL_MODEL
  -> FRONTIER_MODEL
  -> UNKNOWN
```

The router is intentionally a policy surface, not an LLM preference mechanism.

### Security policy gate

- read / inspect / test / verify: allowed
- write: requires sandbox
- network: requires allowlisted host
- destructive / secret: denied
- unknown action class: denied with `UNKNOWN`

Security `UNKNOWN` never becomes implicit allow.

### VIP verification

Required requirement verdicts aggregate as:

```text
any VIOL       -> VIOL
else UNKNOWN   -> UNKNOWN
else all SAT   -> SAT
```

No evidence means `UNKNOWN`, not `SAT`.

### VRR lineage

A non-SAT candidate produces three explicit recovery branches:

1. repair current candidate
2. alternate approach
3. fresh new approach

These are lineage records, not an instruction to auto-run unsafe work.

### Evidence-gated memory

Canonical memory can only be **proposed** when:

- overall verification is `SAT`
- evidence provenance exists

The foundation never auto-commits canonical memory.

## Files

- `core.mjs` - session, evidence, verification, skill, routing, policy, VRR, memory proposal, runtime orchestration
- `pi-adapter.mjs` - Pi session projection boundary
- `core.test.mjs` - deterministic contract tests

## Verify locally

```bash
node --test aicpu/verified-runtime/core.test.mjs
```

## Next integration steps

1. Connect the adapter to a pinned Pi version through RPC before considering in-process SDK coupling.
2. Project Pi session JSONL into Project Brain instead of using raw session logs as long-term memory.
3. Reuse the existing Project Brain verifier as the semantic verifier for project/repository capabilities.
4. Add a sandbox executor and scoped network/credential policies before autonomous writes.
5. Connect `WEB_HEALTH_CHECK` as the first real deterministic executor skill.
6. Add VIP-aware compaction so Success Contract, evidence and unresolved UNKNOWN state cannot disappear during context reduction.

## Non-goals of V0.1

- no unrestricted shell execution
- no automatic merge/deploy
- no automatic canonical memory writes
- no assumption that a Pi transcript is verified truth
- no assumption that successful CI alone is semantic proof

Core rule:

> Pi gives the harness pattern. Jev controls compute and authority. VIP proves. VRR recovers. UNKNOWN never silently passes.
