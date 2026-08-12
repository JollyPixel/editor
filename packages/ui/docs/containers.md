# Containers

Importing `@jolly-pixel/ui` registers the container and chrome elements.

## Surfaces

`jolly-dock`, `jolly-floating`, and `jolly-dialog` provide visible surfaces. `jolly-pane` also
paints a surface when used on its own; a dock or floating window removes that extra treatment from
its direct panes. `jolly-folder` and `jolly-tabs` are transparent and inherit their surroundings.

Apply `themeStyles` to a scope host above containers. A pane is not a theme scope.

## Pane and Folder

`jolly-pane` provides a title, an `actions` slot, and scrollable content:

```html
<jolly-pane heading="Inspector" reorderable storage-key="scene-inspector">
  <jolly-button slot="actions">Reset</jolly-button>
  <jolly-folder label="Transform">...</jolly-folder>
  <jolly-folder label="Material">...</jolly-folder>
</jolly-pane>
```

`collapsible` lets users fold a pane to its header. Folded panes report `collapsed`. A pane can
reorder its direct `jolly-folder` children when `reorderable` is set. Pointer dragging and
Space, Up/Down, Space support the interaction; Escape cancels it. A committed reorder emits
`jolly-reorder` with `{ keys }`.

Folders are open by default. Header activation emits `jolly-toggle` with `{ open }`. Set `key` or
`storage-key` when a label might change and its expanded state should remain stable.

The Pane header exposes `header`, `title`, and `actions` CSS parts for local layout changes.

## Dock

`jolly-dock` attaches panes to an edge:

```html
<jolly-dock key="left" side="left" align="start" collapsible>
  <jolly-pane key="hierarchy" heading="Hierarchy" collapsible grow></jolly-pane>
  <jolly-pane key="inspector" heading="Inspector" collapsible></jolly-pane>
</jolly-dock>
```

`side` accepts `left`, `right`, `top`, or `bottom`. Without `align`, panes share the available
main-axis space. With `align="start"` or `align="end"`, panes use their content size; `grow` lets
one pane take remaining space. Aligned docks scroll when their panes exceed the available space.

`overlay` makes a dock float above content instead of reserving layout space. It defaults to
`align="start"` and does not have a resize handle. When the layout is contained rather than
viewport-sized, position an overlay dock relative to that container:

```css
.editor-stage { position: relative; }
.editor-stage jolly-dock[overlay] { position: absolute; }
```

Docks resize by pointer or keyboard. `collapsible` docks also toggle with double-click or Enter.
They emit `jolly-resize` during the interaction and `jolly-resize-end` when it commits.

## Dock layout

`jolly-dock-layout` coordinates docks, panes, and floating windows. It has no layout geometry of
its own, so arrange its children with your CSS:

```html
<div class="editor-stage">
  <jolly-dock-layout storage-key="voxel-editor">
    <jolly-dock key="left" side="left" align="start">
      <jolly-pane key="hierarchy" heading="Hierarchy"></jolly-pane>
    </jolly-dock>
    <main>...viewport...</main>
    <jolly-dock key="hud" side="right" overlay align="end">
      <jolly-pane key="tools" heading="Tools"></jolly-pane>
    </jolly-dock>
  </jolly-dock-layout>
</div>
```

Within a layout, users can reorder panes, move them between docks, extract them into floating
windows, and dock an existing window. Changes commit on release; Escape cancels a drag. Keyboard
users can use a pane grip: Space grabs, arrow keys move, Space commits, and Escape restores the
starting arrangement.

Set `locked` on fixed panes. Locked panes cannot move and always use their authored placement,
even when a stored layout exists. `resetLayout()` restores the authored arrangement; `snapshot()`
returns the current one; committed changes emit `jolly-layout-change`.

`jolly-floating` also works outside a layout. Its pane header moves the window, while its right
and bottom edges resize it, plus a bottom-right corner that resizes both at once from a single
drag; it cannot dock without a layout.

## Tabs and Tab

`jolly-tabs` renders direct `jolly-tab` children as an accessible tab set:

```html
<jolly-tabs value="build">
  <jolly-tab value="build" label="Build">...</jolly-tab>
  <jolly-tab value="paint" label="Paint">...</jolly-tab>
</jolly-tabs>
```

`value` is presentation state and is not persisted. Missing or invalid values select the first
enabled tab. User selection emits `jolly-change` with `{ value }`. Tabs support roving focus,
Home/End, and orientation-appropriate arrow keys.

## Toolbar and Rail

`jolly-toolbar` provides toolbar semantics. Set `orientation="horizontal|vertical"` and an
accessible `label`. `jolly-rail` is a stateless persistent strip, vertical by default, intended
for compact icon controls.

## Persistence

Pane, Folder, Dock, Floating, and DockLayout accept a `storage` property with a `StorageAdapter`
and support `storage-key`. Set an explicit key when otherwise-identical stateful containers share
a page, or when a title might change.

Inside `jolly-dock-layout`, the layout writes one snapshot for dock placement, size, collapse
state, floating windows, and pane collapse state. Folder expansion and order remain pane state.
Outside a layout, docks and floating windows persist independently.

Stored state overrides matching authored state. New containers still appear where markup places
them; removed containers are ignored. Future snapshot versions are discarded.
