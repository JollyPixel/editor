# EditorToolbar

`<jolly-editor-toolbar>` is the bar an editor puts above its viewport. On a
standalone page it lists the other assets the editor can open, and wherever
the session allows it, it creates, views, restores and deletes the tags of
the target. Importing `@jolly-pixel/editor.host/ui` defines it.

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

The bar is as tall as a pane group's tab strip and does not overlap the
viewport, so put it in a column above the element holding the canvas. When
`sources` is `null`, or holds no `tags` and fewer than two `targets`, it sets
the `empty` attribute and hides itself.

The bar never draws outside its own width. Below 560px it hides the Asset and
Version captions and shows Save version as an icon button. Below 360px it
hides the Read-only text and keeps only the lock.

## Properties

### `sources: EditorToolbarSources | null`

Its `targets` shows the Asset select, listing the paths of the target and its
siblings without their extension, such as `maps/overworld` for
`maps/overworld.voxelmap.json`. Picking one opens it. The select is hidden
when the target is the only asset of its kind.

Its `tags` shows the Version select, and the bar loads the tags as soon as
`sources` is set. The select
starts with Current version, then lists each tag as its name, date and
message, then each restore point as Before restore with its date. Picking an
entry opens that version, and picking Current version goes back.

On the current version the bar offers Save version (accent), which runs
`create()`.
While the page shows a tag it shows a lock icon with the text Read-only and two
icon buttons instead: Restore this version (accent) and Delete this version
(danger). The bar is disabled while an action or a switch runs, and a failed
one shows its error in the bar until the next action.

## EditorToolbarSources

```ts
class EditorToolbarSources {
  readonly targets: EditorTargets | null;
  readonly tags: EditorTags | null;

  constructor(targets: EditorTargets | null, tags: EditorTags | null);
  dispose(): void;
}
```

`mountStandalone` opens the sources from the launch it read and passes them to
`mount` as `context.toolbar`. `targets` is `null` inside a shell, which picks
the target itself, and for a share link. `tags` is `null` for a share link and
for an offline workspace, whose in-memory event store loses tags on reload.
`tags.viewing` is the tag of the launch.

Both sources listen to the session catalog until `dispose()`. The catalog
outlives a switch, so `mountStandalone` disposes the sources of the editor it
replaces.

## LaunchNavigator

```ts
interface LaunchNavigator {
  navigate(target: string, tag: string | null): Promise<void>;
}
```

`targets` and `tags` open another asset or version through it.
`mountStandalone` passes itself; see
[switching](../editor/mountStandalone.md#switching-target-or-tag).

## EditorTargets

```ts
class EditorTargets extends Emitter<{ change: () => void; }> {
  readonly accepts: string;
  readonly current: string;

  [Symbol.iterator](): IterableIterator<AssetRecordData>;
  open(assetId: string): Promise<void>;
  dispose(): void;
}
```

### `[Symbol.iterator]()`

Yields the catalog records of the `accepts` kind, sorted by path. `change`
fires on every catalog change.

### `open(assetId)`

Navigates to the current version of `assetId` and resolves once it is open.
Opening `current` does nothing.

## EditorTags

```ts
class EditorTags extends Emitter<{ change: () => void; }> {
  readonly assetId: string;
  readonly viewing: string | null;

  [Symbol.iterator](): IterableIterator<AssetTag>;
  restorePoints(): IterableIterator<AssetTag>;
  load(): Promise<void>;
  create(): Promise<AssetTag | null>;
  restore(name: string): Promise<RestoreReport | null>;
  delete(name: string): Promise<boolean>;
  view(name: string | null): Promise<void>;
  dispose(): void;
}
```

### `[Symbol.iterator]()` and `restorePoints()`

The named tags and the `restore/<n>` restore points, each newest content
first. Both are empty until `load()` resolves. `change` fires when the list
is loaded and when the catalog reports `tags-changed` for `assetId`.

### `load()`

Asks the catalog for the tags of `assetId`. Concurrent calls share one
request, and a failed request can be retried.

### `create()`

Asks for a name and an optional message, then tags the current content.
Resolves with `null` when the dialog is dismissed. A name outside the tag
name rules rejects with `InvalidTagNameError` before anything is sent.

### `restore(name)`

Asks to confirm, warning that changes not acknowledged yet are lost, then
restores the tag. Open editors receive the restored content as a new
snapshot. When the page shows a tag, it then navigates back to the current
version. Resolves with the `RestoreReport`, or `null` when the user cancels.

### `delete(name)`

Asks to confirm, then removes the tag. The asset content does not change.
Deleting the tag the page shows navigates back to the current version.
Resolves with `false` when the user cancels.

### `view(name)`

Navigates to tag `name` of `assetId`, or to its current version for `null`,
and resolves once it is open. Viewing `viewing` does nothing.

Navigation goes through the required `navigator` option. Dialogs go through
the `browser` option, an `EditorTagsBrowser` with `askNewTag()` and
`confirm(options)`, which defaults to the DOM dialogs.

## Tag views

A page whose URL has `?tag=` next to the target's `?target=` opens the target
through its tag room (`kind@tag:assetId`). The server serves the tagged
content there and grants `read` on every command, so an editor that follows
its room grants turns read-only. The parent's `jolly-launch` keeps the tag of
the frame URL when both name the same target, which is how a tag opens inside
the studio. Dependencies stay on their current version.
