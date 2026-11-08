---
"@jolly-pixel/asset-server": minor
"@jolly-pixel/network": minor
"@jolly-pixel/ui": minor
"@jolly-pixel/three": minor
---

Kind handlers can declare a `preview(state)` hook, served by the `catalog:preview` query (`CatalogClient.preview`) and flagged `preview: "server"` on loaded kind descriptors; the built-in texture kind previews browser images up to 2 MiB and is now listed by `ProjectKinds.descriptors()`.
Peer profiles accept `observer: true`, set by `toPeerProfileMetadata(identity, { observer })` and left out by `PeerRoster` and `RoomPresenceSource`.
Three adds `renderToTarget` and `ReadbackPixels`, which turns a render-target readback into straight-alpha, top-down RGBA.
