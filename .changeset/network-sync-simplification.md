---
"@jolly-pixel/network": major
"@jolly-pixel/asset-server": major
"@jolly-pixel/three": major
"@jolly-pixel/ui": patch
---

Replace `SyncAdapter` with `CommandSync`, add `PresenceChannel`, and slim `ConflictTracker` to `admit`/`admitEach`; presence set before `join()` now travels with the join.
Asset rooms stamp the sender's `clientId` server-side, and three's peer syncs drop `resyncIntervalMs` and their message type parameters.
