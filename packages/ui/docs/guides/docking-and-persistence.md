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

Wrap panes in a `jolly-pane-group` to show them as tabs. Users drag a tab onto
another pane header or tab strip to group it, or anywhere else to give it its
own slot. An empty `jolly-dock` is a placeholder: it takes no space until a pane
is dropped into it, and gives the space back when its last pane leaves.

```html
<jolly-dock-layout storage-key="voxel-editor">
  <jolly-dock key="left" side="left">
    <jolly-pane-group>
      <jolly-pane key="general" heading="General"></jolly-pane>
      <jolly-pane key="blocks" heading="Blocks"></jolly-pane>
    </jolly-pane-group>
  </jolly-dock>
  <main>Viewport</main>
  <jolly-dock key="right" side="right"></jolly-dock>
</jolly-dock-layout>
```

Set `double` on a left or right dock to let users open a second column on
wide screens. Dragging a pane just past the dock's inner edge opens it; the
dock doubles its width, and resizing splits the new width between the two
columns. Author `slot="secondary"` on a child to start with the column open.

```html
<jolly-dock key="left" side="left" size="320" double>
  <jolly-pane key="blocks" heading="Blocks"></jolly-pane>
  <jolly-pane key="paint" heading="Paint" slot="secondary"></jolly-pane>
</jolly-dock>
```

Listen to `jolly-pane-visibility` to pause work in a pane nobody can see.

Set `locked` on panes whose authored placement must remain fixed. Call
`resetLayout()` to restore the authored layout or `snapshot()` to read the
current `LayoutSnapshot`.

Pane, Folder, Dock, Floating, DockLayout, ThemePreferences, and Stats accept a
`StorageAdapter` where they persist state. A `LocalStorageAdapter` shared by
the page is the default.
Inside a dock layout, the layout owns dock and floating geometry. Folder state
remains attached to its pane.
