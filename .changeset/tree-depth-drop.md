---
"@jolly-pixel/ui": minor
---

`jolly-tree` drops past the last (or before the first) row now read horizontal
position as depth, promoting the dragged node up its ancestor chain or
straight to root. Drop indicators start at the target row's own indent
instead of spanning the blank gutter to its left, and no longer linger after
a drop. The tree also adds an `indentGuides` option, stops showing the expand
arrow on a childless branch, and keeps its arrow and node icons flush and
equal in size.
