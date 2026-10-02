---
"@jolly-pixel/ui": patch
---

Faster large trees, dock and floating drags, scrubbing, graphs, stats and presence locks: fewer per-row lookups, DOM measurements and re-renders, with identical output.
`jolly-tree` no longer re-renders when `selected` or `expanded` receives an equal array.
