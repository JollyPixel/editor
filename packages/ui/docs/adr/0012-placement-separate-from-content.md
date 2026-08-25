---
status: accepted
---

# Placement is separate from content

`jolly-pane` holds content and fills its container; `jolly-dock`, `jolly-floating` and
`jolly-dialog` position it. Docked and floating panes therefore share all content code, and the
facade defaults to wrapping in `jolly-floating`, matching Tweakpane.

The docked wrapper is `jolly-dock`, not `jolly-panel`, so no two tags differ by one character. The
element constructor is exported as `PaneElement`, reserving `Pane` for the facade.

## Considered Options

- **One component with a `placement` attribute.** One class owning docking, dragging, resizing and
  content — the shape that hit the max-lines ceiling in `PixelArtCanvas.ts`.
