---
"@jolly-pixel/network": minor
---

`Server.revoke(subject)` closes a subject's connections with code `4001` so clients authenticate again.
Providers may implement `watchRevocations` to trigger it, and `ClientHandle` gains an optional `close(code, reason)`.
