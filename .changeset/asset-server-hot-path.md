---
"@jolly-pixel/asset-server": patch
"@jolly-pixel/network": minor
"@jolly-pixel/event-store": patch
---

Cache the catalog join snapshot and HTTP body per catalog revision, defer projection state saves of single-asset flushes by up to a second, and drop per-command allocations on asset room edits.
A room validates and serializes a frozen outbound payload once and reuses it. The sqlite append no longer scans the asset's whole history to find its next version.
