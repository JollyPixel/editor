---
"@jolly-pixel/ui": minor
---

`jolly-dialog` emits `jolly-exited` once its exit transition ends and exposes a read-only `closing` flag until then, so an owner can keep the body unchanged while the dialog fades out.
