---
status: accepted
---

# Four editor tabs, frames loaded on first focus

At most four editor tabs are open. Each editor holds several WebGL contexts, and Chrome caps a page
at sixteen shared across its same-origin frames. Opening a fifth asks to close the least recently
activated tab; cancelling leaves the request unopened. The Home tab does not count.

A tab creates its iframe the first time it is focused. Inactive frames stay mounted with
`display: none`: their sockets stay open and their render loops pause with the frame.

`EditorTabs` is an imperative controller beside the Lit elements. Moving or re-creating an iframe
reloads it, so no template owns the frames, and reordering moves only the strip items.

## Considered Options

- **No cap.** A fifth or sixth editor silently loses WebGL contexts.
- **Unloading hidden frames.** Saves contexts, but every switch reboots an editor and drops its
  undo history.

## Consequences

Restored tabs ([ADR-0006](./0006-open-tabs-persist-per-browser.md)) and tabs of a rebuilt editor
load nothing until focused.
