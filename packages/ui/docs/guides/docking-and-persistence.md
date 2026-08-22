# Docking and persistence

`jolly-dock-layout` owns pane placement when it contains docks and floating
windows. Users can reorder panes, move them between docks, or extract a pane
into a floating window.

```html
<div class="editor-stage">
  <jolly-dock-layout storage-key="voxel-editor">
    <jolly-dock key="left" side="left">
      <jolly-pane key="hierarchy" heading="Hierarchy"></jolly-pane>
    </jolly-dock>
    <main>Viewport</main>
    <jolly-dock key="right" side="right">
      <jolly-pane key="inspector" heading="Inspector"></jolly-pane>
    </jolly-dock>
  </jolly-dock-layout>
</div>
```

The layout element has `display: contents`; application CSS places its
children. Pointer moves commit on release. Keyboard users grab a pane with
Space, move it with arrow keys, commit with Space, and cancel with Escape.

Set `locked` on panes whose authored placement must remain fixed. Call
`resetLayout()` to restore the authored layout or `snapshot()` to read the
current `LayoutSnapshot`.

Pane, Folder, Dock, Floating, DockLayout, ThemePreferences, and Stats accept a
`StorageAdapter` where they persist state. `LocalStorageAdapter` is the default.
Inside a dock layout, the layout owns dock and floating geometry. Folder state
remains attached to its pane.
