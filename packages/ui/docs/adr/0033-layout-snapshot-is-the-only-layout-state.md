---
status: accepted
---

# The layout snapshot is the only layout state

`jolly-dock-layout` keeps pane placement, dock size and collapse, floating geometry, pane folds and
folder state in one `LayoutSnapshot`. A drag or keyboard move computes the next snapshot with a pure
function in `layout.ts`, then `LayoutProjection` writes it onto the DOM. Nothing reads the DOM back
to learn what changed. Docks, windows and panes report their own edits as a typed `LayoutChange`.

Keys and reconciliation are unchanged, so [ADR-0022](./0022-persistence-keys-and-reconciliation.md)
still holds.

## Considered Options

- **Reading the DOM after each mutation.** This was the previous design. Every layout property needed
  a write mapping, a read mapping and a side cache, and a slot change could reconcile a stale
  snapshot over a move that had just been made.
- **Children writing straight to storage.** Two owners for one persisted document.

## Consequences

A property set on a dock or window from outside, without an interaction that reports it, is not in
the snapshot until the next `sync()`. Clamping a window to the viewport is a display concern and is
not recorded.
