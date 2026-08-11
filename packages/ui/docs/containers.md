# Containers

Importing `@jolly-pixel/ui` registers the nine container and chrome elements.

## Surfaces

Containers split into two roles.

**Planes** paint an opaque surface. `jolly-dock` and `jolly-rail` are in flow; `jolly-dialog` and
`jolly-floating` are detached and are the only containers that cast a shadow.

**In-pane containers** paint nothing and inherit whichever plane they land on. `jolly-folder` and
`jolly-tabs` are transparent. `jolly-pane` is the hybrid: it paints a surface so a standalone pane
still reads as a plane, and `jolly-dock` and `jolly-floating` remove that when they contain one.

Separation comes from the fill on controls plus `--jolly-row-gap`, not from borders. A container
that paints its own translucent background will wash out everything inside it, since the control
fills composite over it.

## Pane and Folder

`jolly-pane` owns a title, an `actions` slot, and scrollable content. The constructor is exported
as `PaneElement`; the `Pane` name is reserved for the builder facade.

A pane is not a theme scope. Apply `themeStyles` to a scope host above it; a pane that declared
tokens itself would reset `color-scheme` and break theme inheritance for its subtree.

```html
<jolly-pane title="Inspector" reorderable storage-key="scene-inspector">
  <jolly-button slot="actions">Reset</jolly-button>
  <jolly-folder label="Transform">...</jolly-folder>
  <jolly-folder label="Material">...</jolly-folder>
</jolly-pane>
```

Only direct Folder children participate in Pane reordering. Each reorderable folder has a grip:
drag it with a pointer, or press Space and use Up/Down. Space commits; Escape restores the
starting order. Committed order emits `jolly-reorder` with `{ keys }` and persists through the
Pane's `StorageAdapter`.

Folder `open` defaults to `true`. Header activation emits `jolly-toggle` with `{ open }` and
persists expansion. Set `key` or `storage-key` when labels are not stable identifiers.

## Tabs and Tab

`jolly-tabs` renders its direct `jolly-tab` children as an accessible tab set.

```html
<jolly-tabs value="build">
  <jolly-tab value="build" label="Build">...</jolly-tab>
  <jolly-tab value="paint" label="Paint">...</jolly-tab>
</jolly-tabs>
```

`value` is presentation state and is not persisted. Missing or invalid values select the first
enabled tab. User selection emits `jolly-change` with `{ value }`. Tabs use automatic activation,
roving focus, Home/End, and orientation-specific arrow keys; disabled tabs are skipped.

## Toolbar and Rail

`jolly-toolbar` supplies toolbar semantics and accepts `orientation="horizontal|vertical"` plus
an accessible `label`. `jolly-rail` is a stateless persistent strip, vertical by default, sized
for 32px icon controls. Commands, selection, and focus behavior belong to their slotted controls.

## Persistence

Pane, Folder, Dock, and Floating expose a `storage` property accepting `StorageAdapter` and a
`storage-key` override. Without an override, keys include the current pathname and identifying
container attributes. Use an explicit key when multiple otherwise-identical stateful containers
share a page.
