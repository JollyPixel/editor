---
status: accepted
---

# The asset browser lives on the Home tab

The Home tab is the project page: the asset browser in a resizable left dock and the project
overview beside it, which counts the assets per kind and lists the open editors. An editor tab
fills the whole workbench, with no dock beside its frame.

`<studio-home>` is hidden, never unmounted, while an editor tab is active, so the tree keeps its
expanded folders, selection and scroll across tab switches. Its dock layout is
saved under `studio:home-layout`; the old `studio:layout` key, which could hold a collapsed dock,
is no longer read.

## Considered Options

- **A collapsible dock beside every tab.** The first layout. The editors bring their own docks,
  so the shell's dock took width from each of them and collapsing it was one more chore.
- **An overlay drawer over the editors.** Covers the editor's left dock and still needs a toggle.

## Consequences

Opening a second asset from the tree goes through Home. An editor that wants another asset opened
posts the `open-asset` shell command ([ADR-0004](./0004-the-shell-channel-is-one-way.md)).
