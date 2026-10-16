---
"@jolly-pixel/engine": patch
---

`GlobalAudio` creates its `AudioListener`, and the browser `AudioContext` behind it, on first use instead of in the constructor, so a world that plays no sound opens no audio context.
