---
"@jolly-pixel/network": minor
---

Batch each socket's WebSocket writes per event loop turn and cut per-message allocations on the server and client receive paths.
Add the opt-in `trustServer` client option, which skips prototype scrubbing and envelope schema checks on server messages.
