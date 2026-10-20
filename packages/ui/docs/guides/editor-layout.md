# Editor layout

Arrange panes around a viewport with `jolly-dock-layout`. Users reorder panes,
move them between docks, group them as tabs and float them, and the layout
stores the arrangement.

## 1. Declare the layout

```html
<jolly-scope class="editor">
  <jolly-dock-layout storage-key="voxel-editor">
    <jolly-dock key="left" side="left">
      <jolly-pane key="hierarchy" heading="Hierarchy"></jolly-pane>
    </jolly-dock>
    <main class="viewport"></main>
    <jolly-dock key="right" side="right">
      <jolly-pane key="inspector" heading="Inspector"></jolly-pane>
    </jolly-dock>
  </jolly-dock-layout>
</jolly-scope>
```

```css
.editor {
  display: flex;
  height: 100vh;
}

.viewport {
  flex: 1 1 0;
  min-width: 0;
}
```

- The layout has `display: contents`. The application CSS places its
  children.
- `key` is the identity a dock or pane is stored under. Without one, it is
  derived from the pane `heading` or the dock `side`, so renaming a pane drops
  its saved place. Give every pane a `key`.
- Users move panes with the pointer, or with Space on a pane grip followed by
  the arrow keys.

## 2. Group panes as tabs

```html
<jolly-dock key="left" side="left">
  <jolly-pane-group>
    <jolly-pane key="general" heading="General"></jolly-pane>
    <jolly-pane key="blocks" heading="Blocks"></jolly-pane>
  </jolly-pane-group>
</jolly-dock>
<jolly-dock key="right" side="right"></jolly-dock>
```

- A pane dropped on a header or a tab strip joins that group. Dropped anywhere
  else in a dock, it takes its own slot.
- An empty dock takes no space until a pane lands in it.

## 3. Limit what a dock accepts

```html
<jolly-dock key="left" side="left" drop="tabs"></jolly-dock>
<jolly-dock key="status" side="bottom" drop="none">
  <jolly-pane key="log" heading="Log" locked></jolly-pane>
</jolly-dock>
```

- `drop="tabs"`: a pane released over a slot joins its group, so panes never
  stack in a narrow dock.
- `drop="none"`: the dock takes no pane. A pane released over it floats.
- `locked` keeps a pane in its authored place.

## 4. Offer a second column

```html
<jolly-dock key="left" side="left" size="320" double>
  <jolly-pane key="blocks" heading="Blocks"></jolly-pane>
  <jolly-pane key="paint" heading="Paint" slot="secondary"></jolly-pane>
</jolly-dock>
```

Dropping a pane just past the inner edge of a `double` dock opens the column.
`slot="secondary"` starts with it open.

## 5. Pause what nobody sees

```ts
const layout = document.querySelector("jolly-dock-layout");

layout.addEventListener("jolly-pane-visibility", (event) => {
  const { pane, visible } = event.detail;
  if (pane === "preview") {
    preview.paused = !visible;
  }
});
```

- A pane is visible when it floats, or when it is the active tab of a dock
  that is not collapsed.
- The first projection reports every pane. Add the listener before the layout
  upgrades, or read `layout.paneVisible("preview")` once it has.

## 6. Move one element between panes

Two panes can need the same costly element, such as a texture editor. Move it
to wherever it is shown:

```ts
const place = () => {
  const target = layout.paneVisible("paint") ? paint : blocks;
  if (textureEditor.parentElement !== target) {
    target.append(textureEditor);
  }
};

layout.addEventListener("jolly-layout-change", place);
layout.addEventListener("jolly-pane-visibility", place);
void layout.updateComplete.then(place);
```

- `jolly-layout-change` follows each saved change, with the new snapshot.
- `layout.placement("paint")` tells which dock, column and group a pane is in,
  and whether it is the active tab. It is `null` for a floating pane.
- Moving an element disconnects and reconnects it. A Lit element keeps its
  state, and its controllers subscribe again.

## 7. Add panes from code

```ts
const pane = document.createElement("jolly-pane");
pane.key = "stats";
pane.heading = "Stats";
document.querySelector("jolly-dock[key=right]").append(pane);
layout.sync();
```

`sync()` reconciles the markup with the stored arrangement. A pane the
snapshot already knows goes back where the user left it.

## 8. Reset and persist

- `layout.resetLayout()` restores the authored arrangement. Offer it as a
  command: a user who lost a pane has no other way back.
- The layout stores dock sizes, columns, groups and floating windows under its
  `storage-key`. Folder state stays with its pane.
- `layout.storage` replaces `localStorage`, such as a per-project store. See
  [Persisting settings](./persisting-settings.md).
