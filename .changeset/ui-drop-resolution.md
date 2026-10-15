---
"@jolly-pixel/ui": major
---

`Dock.dragZones(pane, lifted?)` replaces `dropZone`, `previewZone`, `dropCandidates`, `dropStacks`, `insertionLine` and `acceptsSecondary`, and `PaneGroup.dragStack(slot, pane, lifted)` replaces `tabsRect`, `tabCandidates` and `tabLine`.
`resolveDepthDropTarget`, `resolveDropDepth` and `ancestorChain` are no longer exported; use `TreeSnapshot.ancestorChain`. A `jolly-tabs` whose tabs are all disabled now selects the first tab instead of none.
