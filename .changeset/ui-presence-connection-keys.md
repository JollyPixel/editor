---
"@jolly-pixel/network": minor
"@jolly-pixel/ui": major
"@jolly-pixel/three": minor
---

`RoomPresenceSource(room)` and `PeerRoster` key peers by connection and read the local peer from `room.profile`, now the claimed profile until `sync`; both drop `identity`, and claims travel under `fieldLock`.
`@jolly-pixel/network` adds `parsePeerProfile`, `PeerProfileMetadata`, `GUEST_USERNAME` and `PresenceChannel.published`; `ui` drops `readUsername`, `readPeerId`, `readAvatar`, `readBadge`, `NullPresenceSource` and `LocalPeerIdentity`, and renames `presencePeerOf` and `toPeerMetadata` to `toPresencePeer` and `toPeerProfileMetadata`.
`PeerFrustumSync` labels a peer without a `username` as `"Guest"` by default.
