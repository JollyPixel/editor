---
"@jolly-pixel/console": patch
---

A registered command creates its `AbortController` only when its `signal` is first read, so unregistering a command that never ran no longer builds an `AbortError`.
