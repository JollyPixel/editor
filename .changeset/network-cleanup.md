---
"@jolly-pixel/network": major
---

`Client` takes a `socket` factory instead of `id`/`url`/`credential`, rooms get a stricter lifecycle (`clientId` is `null` until admitted, `leave()` emits `"left"`, `sync` replaces `peers`, one `RoomRejectionEvent`), and the `MessageProtocol` class replaces `defineMessageProtocol` and its helpers.
Message guards validate the whole shape with zod, and notice types can no longer be `"snapshot"` or `"command"`.
`PresenceChannel` accepts a zod schema as `decode`, and `Server.authenticate` refuses the client instead of throwing when the provider fails.
