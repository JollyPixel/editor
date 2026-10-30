# EditorToolbar

`<jolly-editor-toolbar>` is the bar above an editor's viewport. Importing
`@jolly-pixel/editor.host/ui` defines it.

```html
<div class="viewport-column">
  <jolly-editor-toolbar></jolly-editor-toolbar>
  <div id="viewport">
    <canvas></canvas>
  </div>
</div>
```

```ts
import "@jolly-pixel/editor.host/ui";

const toolbar = document.querySelector("jolly-editor-toolbar")!;
toolbar.sources = context.toolbar;
```

The bar takes its own row and never overlaps the canvas, so put it in a
column above the element that holds the canvas.

## sources: EditorToolbarSources | null

`context.toolbar`, built by the host for the current launch. From it the bar
shows:

- An Asset select and an Asset actions menu: rename, export, export a
  dependency, import, delete. Hidden inside a shell, which picks the asset
  itself, and on a share link.
- A Version select with Save, Restore and Delete version. Hidden on a share
  link and in offline mode. A `?tag=` page shows the tag read-only.
- An Offline badge while the server is unreachable.
- A Tours button while at least one tour is registered.

The bar hides itself (`empty` attribute) when there is nothing to show.
