---
"@jolly-pixel/ui": patch
---

Drop the leading inset a field kept for a label it does not render. A field with
an empty label now reflects `unlabeled` and gives its value the whole row, inset
evenly on both edges.
