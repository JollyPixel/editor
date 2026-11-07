---
"@jolly-pixel/network": major
"@jolly-pixel/asset-server": minor
"@jolly-pixel/pixel-draw.renderer": major
---

Extension sends and `ClientConnection.sendFrame` take `SendOptions { compress }`; WebSocket deflates a binary frame only when it is hinted, replacing `compression.binary`.
Asset kinds hint with `compressSnapshot`, `parts.compress` or `binaryCommands(type, { compress })`. `PngPixels.data` is now `Uint8Array`.
