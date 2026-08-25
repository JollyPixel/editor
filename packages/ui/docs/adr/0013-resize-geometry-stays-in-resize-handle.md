---
status: accepted
---

# Resize geometry stays in `@jolly-pixel/resize-handle`

`jolly-dock` delegates resizing to `@jolly-pixel/resize-handle` rather than computing size from
pointer delta itself. That package gains explicit bounds, a shared `sizeFromDelta()` that pointer
and keyboard input both call, and an optional supplied `handle` so a shadow root can own the handle
while the host stays the resize target.

## Considered Options

- **`ui` owning size-from-delta.** A second copy would not exercise the code that actually runs, and
  duplication is what this package exists to remove.

## Consequences

The misspelt `collapsable` option is replaced by `collapsible`, a breaking change to
`@jolly-pixel/resize-handle`. `jolly-dock` still owns its own collapsed state, because a
`ResizeHandle` applying `display: none` to the host would also hide a shadow-root handle.

One rule is injected onto `document.documentElement` (`html.handle-dragging`), because suppressing
pointer events during a drag cannot work from inside a shadow root.
