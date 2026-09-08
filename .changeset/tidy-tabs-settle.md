---
"@jolly-pixel/ui": patch
---

Resolve the selected tab in `willUpdate` instead of `updated`, so a `value`
assigned before the tabs are slotted survives the first render and Lit no
longer warns about an update scheduled after an update completed.
