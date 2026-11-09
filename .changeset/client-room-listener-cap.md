---
"@jolly-pixel/network": patch
---

`ClientRoom` accepts up to 32 listeners per event, so an editor with one channel per collaboration concern no longer logs leak warnings.
