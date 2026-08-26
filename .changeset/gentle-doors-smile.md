---
"@jolly-pixel/event-store": minor
"@jolly-pixel/asset-server": minor
"@jolly-pixel/network": minor
"@jolly-pixel/pixel-draw.renderer": minor
---

Cut editor boot time by stopping the client from re-uploading its whole
placeholder atlas on every load, resuming asset replay from the last snapshot
checkpoint, and letting rooms resolve without blocking one another.
