---
"@jolly-pixel/ui": patch
"@jolly-pixel/history": patch
---

`jolly-pane-group` and `jolly-context-menu` no longer schedule an update from inside a finished one (Lit "change-in-update" warning).
`CommandDocument` allows 32 listeners per event before the emitter warns about a leak.
