---
"@jolly-pixel/network": major
---

Replace `limits.peerMetadataLength` with `profileLength` (16 KiB), `presenceLength` (1 MiB) and `resumeLength` (16 KiB), and remove members whose role lost `$join` when rights are replaced.
Harden frame decoding, avatar paths, password throttling (`clientKey`, IPv6 `/64`) and channel relays (`maxRelays`).
Export `HandshakePolicy` from `/node` so HTTP servers apply the transport's `allowedHosts`.
