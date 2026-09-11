---
"@jolly-pixel/network": major
"@jolly-pixel/asset-server": major
"@jolly-pixel/three": major
"@jolly-pixel/pixel-draw.renderer": major
"@jolly-pixel/voxel.renderer": major
---

Authenticate connections at the WebSocket handshake through a server-configured
`AuthenticationProvider`, and split the trusted `PeerIdentity` from the client's
untrusted `profile` (renamed from `identity`).
Rooms now report a joining client's resolved rights, and a role absent from a
configured rights table is denied instead of granted.
