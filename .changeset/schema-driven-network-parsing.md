---
"@jolly-pixel/network": major
"@jolly-pixel/asset-server": major
"@jolly-pixel/pixel-draw.renderer": major
"@jolly-pixel/voxel.renderer": major
---

Parse the wire with JSON Schema instead of hand-rolled guards. Envelopes split
by direction (`Envelope.parseClient` / `parseServer`), and an extension now
declares `protocols` in place of `events` and `getEventName`, so the room parses
payloads and derives rights keys from the schema variant that matched.

This fixes broadcast filtering: outbound payloads were gated on an event name
they never carried, so with a rights table configured a `voxel.renderer.*` rule
filtered the wrong key on every fan-out.
