---
status: accepted
---

# Editor entries never top-level-await their mount

An editor page's bundle puts `editor.host`, the runtime and `@jolly-pixel/ui` into the entry chunk.
The runtime lazily imports chunks (performance stats, metrics panel, offline workspace) that import
from that entry chunk. A top-level `await` in the entry makes those imports wait for the entry,
and the entry wait for them: the page hangs with nothing logged.

Vite dev never bundles, so the hang only shows in a built page, which is what the studio serves.
Entries call `void boot()`.
