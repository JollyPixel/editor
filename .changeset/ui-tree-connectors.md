---
"@jolly-pixel/ui": minor
---

`jolly-tree` indent guides now connect each row to its parent and stop at the last child, with `indentGuidesScope: "selected"` to draw only the selected rows' path; `toggleStyle: "box"` draws a plus/minus toggle, and the highlight is exposed as the `content` part (`leaf`, `branch`, `selected`).
`PeerAvatar.presence` (`jolly-avatar` `presence`) draws an online or offline dot and announces it.
`TreeSnapshot.hasBranches` is replaced by `TreePlacement.levelHasBranches`, set per sibling level.
