# Next Session Guide

Last updated: 2025-11-07

## 1. Quick Project Orientation

- Tech stack: React + TypeScript + Vite + Three.js for visualization.
- Core model logic: `src/models/SimulationModel.ts`
- Rendering utilities: `src/utils/NodeRenderer.ts`, `ConnectionRenderer.ts`, `MessageRenderer.ts`
- UI panels: `NodeInfoPanel.tsx`, `NodeDetailPanel.tsx`, `SimulationView.tsx`

## 2. Key Features Implemented

- FOORS+ routing states: intelligent, flooding, inactive, no-connections.
- Inactive routes retained with timeout; flooding engages during uncertainty or sink disconnection.
- Severity-aware triages (black, green, yellow, red) with controlled multi-route forwarding.
- Triage queuing for disconnected nodes; queued triages flushed on reconnection.
- Sinks also forward messages intelligently (act as routers) unless in flooding/inactive mode.
- ACK handshake per hop (reliability) with pending/timeout tracking.
- Subnet sync (triage-summary + triage-request + replay) for triages first seen in non-intelligent modes.
- Visual differentiation of message types: regular vs subdued ACK spheres.

## 3. Current Known Issues / Bugs

1. Subnet Sync Still Buggy:
   - Occasional redundant triage-summary exchanges in edge cases (especially rapid topology changes).
   - Potential race: summaries triggered both on new link and new route update before debounce map updates.
   - Replay bursts if multiple requests overlap for same triage IDs.
2. Missing Sink Awareness in Some Edge Cases:
   - When a sink appears after a long isolated period, nodes might not mark prior triages intelligently vs uncertain correctly.
3. ACK Timeouts:
   - No retry or escalation policy yet (timeouts just linger until removed).
4. Multi-route selection:
   - Greedy selection doesn’t weight latency or reliability yet; load metric is simplistic.
5. Triage catalog growth:
   - No pruning; long sessions may accumulate large maps.

## 4. High-Value Next Steps (Suggested Order)

1. Stabilize Sync Trigger Conditions:
   - Add a per-node flag `pendingSync` set when routing tables gain a new sink route; process once after routing state settles.
   - Ensure only one summary per (node, peer, window) using a rolling window (e.g. 3–5s).
2. Deduplicate Request/Replays:
   - Maintain a short-lived `recentRequests` set to ignore repeat triage requests.
3. Add Periodic Anti-Entropy (Optional / Low Frequency):
   - Every 60s, each node with sink reach runs a lightweight Bloom-filter exchange instead of full ID list (future optimization).
4. Retry Policy for Timeouts:
   - On timeout, attempt a single resend if route still valid; mark permanently failed after N attempts.
5. Catalog Pruning:
   - Remove triages older than configurable TTL if severity not black/red.
6. UI Enhancements:
   - Display sync activity banner (e.g. "Syncing… missing: 12") in detail panel.
   - Add toggle to disable sync entirely for stress testing.

## 5. Debugging Cheat Sheet

### Inspect Routing Modes

Add temporary console lines inside `updateRoutingStates()` when a node transitions to `intelligent` after previously flooding.

### Trace Sync Trigger

Search for `sendTriageSummary(` occurrences:

- Link-based trigger: `updateConnections()`
- Route-based trigger: `updateRoutingTables()` post-update block.

### Spot Duplicate Requests

Log triage-request message IDs plus first 4 triage IDs to confirm duplicates:

```ts
if (message.type === 'triage-request') {
  console.log('[Sync][Request] part', message.partIndex, 'ids sample', message.requestIds?.slice(0,4));
}
```

### Confirm Filtering Works

Add assertion before sending summary:

```ts
if (ids.some(id => !fromNode.triageCatalog.get(id))) {
  console.warn('Summary contains ID without catalog meta');
}
```

## 6. Architectural Notes on Sync Simplification

- We narrowed summary scope to triages first seen under non-intelligent modes; this reduces fan-out volume drastically.
- Control messages (summary/request) are single-hop; they are not forwarded.
- Potential improvement: shift to a pull-on-demand approach—sink announces last seen sequence number and nodes send only delta beyond that.

## 7. Data Structures Overview

| Structure | Location | Purpose |
|-----------|----------|---------|
| `routingTable` | Node | Active sink next hops with age metadata |
| `inactiveRoutingTables` | Node | Preserves expired/unreachable sink routes for inactivity window |
| `triageStore` | Node | Set of triage IDs already seen (dedup) |
| `triageCatalog` | Node | Severity + timestamp + firstSeenMode for replay decisions |
| `triageQueue` | Node | Triages generated or received while disconnected |
| `pendingAcks` | Node | ACK tracking per hop with timeout status |
| `lastSummaryExchange` | Node | Debounce sync per neighbor |

## 8. Extension Points

- Reliability Layer: Replace simple ACK with cumulative ACK or selective negative ACK for fewer control packets.
- Congestion Control: Slow triage sends when pending ACK > threshold.
- Visualization: Show path selection for red triage via ephemeral edge highlighting.

## 9. Testing Ideas (Manual)

1. Create two disconnected clusters; generate triages in cluster A; bridge them; observe only uncertain triages syncing.
2. Force flooding by removing sinks, then add a sink; verify a single summary burst not repeated.
3. Spam high-severity (red) triages; ensure multi-route cap respected (<=3 distinct next hops).
4. Disconnect a node mid-forward to populate `triageQueue`; reconnect; queue flush should occur before routing table rebuild finishes.

## 10. Minimal Task List to Resume

- [ ] Instrument sync triggers with counters (summarySent, requestSent) for a session log.
- [ ] Implement `recentRequests` dedup (Set with 5s TTL).
- [ ] Add retry-on-timeout for triages (1 attempt) before marking failed.
- [ ] Add UI toggle: Disable Sync (skips summary/request logic).
- [ ] Add pruning: remove triageCatalog entries older than 10 min (unless severity black/red).

## 11. Glossary

- "Uncertain mode": Any of flooding, inactive, no-connections.
- "Intelligent mode": Active routing table entries exist.
- "Replay": Direct resend of a triage identified as missing by peer.
- "Anti-entropy": Periodic reconciliation to converge state.

## 12. Quick Start Next Session

1. Open `SimulationModel.ts` and search `sendTriageSummary` – add instrumentation.
2. Create two subnets with sources only; generate triages; then introduce a sink bridging them.
3. Observe console logs: ensure only uncertain triages summarize.
4. Implement `recentRequests` to stop duplicate replays.

---
Feel free to ask for a reduced-mode branch (without sync logic) if you want a clean baseline comparison.
