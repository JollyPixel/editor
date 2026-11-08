---
"@jolly-pixel/ui": major
---

`PeerMarks` and `PeerMarkSync` replace `PeerMarkMap`, `peerMarks`, `peerBadges` and `reconcilePeerMarks`; `PeerMarkTracker` takes `decode` and a `local` source in place of `readKey`, `localKey` and `publishLocal`.
`FieldLockSource`, `RoomFieldLocks` and `pane.fieldLocks` replace `PresenceSource`, `RoomPresenceSource` and `pane.presence`; a field's `peers` is renamed `editors`, and `lockedBy` is derived from it.
`CollaboratorPresence`, `toPresencePeers`, `LockState` and the index-based `peerColor` are removed.
