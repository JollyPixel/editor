# EditorToolbar

`<jolly-editor-toolbar>` is the bar an editor puts above its viewport. On a
standalone page it lists the assets the editor can open and renames,
exports, imports and deletes them, and wherever the session allows it, it
creates, views, restores and deletes the tags of the target. Importing
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

The bar is as tall as a pane group's tab strip and does not overlap the
viewport, so put it in a column above the element holding the canvas. When
`sources` is `null`, or holds no `tags`, no `targets`, no registered tour
and no offline `connection`, it sets the `empty` attribute and hides itself.

The bar never draws outside its own width. Below 560px it hides the Asset and
Version captions and shows Save version as an icon button. Below 360px it
hides the Read-only and Offline texts and keeps only their icons.

## Properties

### `sources: EditorToolbarSources | null`

Its `targets` shows the Asset select, listing the paths of the target and its
siblings without their extension, such as `maps/overworld` for
`maps/overworld.voxelmap.json`. Picking one opens it. The select stays
visible when the target is the only asset of its kind.

Next to the select, an Asset actions button (three dots) opens a menu on the
target:

- Rename… runs `targets.renameCurrent()`.
- Export as .zip runs `archives.download()`.
- Import archive… runs `archives.pickAndImport()`, only when
  `archives.canImport` is `true`.
- Delete… (danger) runs `targets.removeCurrent()`. It is disabled while
  `targets.canRemoveCurrent` is `false`.
- Reset offline data… (danger) runs `archives.reset()`, only when
  `archives.canReset` is `true`.

The archive entries are the same flows as the `archive` console commands; see
[EditorArchives](./Archives.md#editorarchives).

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

Its `connection` shows a crossed cloud with the text Offline, in the warning
color at the end of the bar, while `online` is `false`. Its tooltip says the
changes wait in the browser when there are any, and that the page is
reconnecting otherwise.

Its `lantern` shows a Tours button, a question mark at the end of the bar,
while at least one tour is registered. With one tour, a click starts it. With
several, it opens a menu listing them by title, with a check on the ones the
user already finished or skipped. A tour can end on
[`REPLAY_TOUR_STEP`](../boot/mountStandalone.md#tours), which points at it.

## EditorToolbarSources

```ts
type EditorToolbarArchives = Pick<
  EditorArchives,
  "canImport" | "canReset" | "download" | "pickAndImport" | "reset"
>;

interface EditorToolbarSourcesOptions {
  targets: EditorTargets | null;
  tags: EditorTags | null;
  archives: EditorToolbarArchives;
  connectionStatus?: ConnectionStatus | null;
  lantern: Lantern;
}

class EditorToolbarSources {
  readonly targets: EditorTargets | null;
  readonly tags: EditorTags | null;
  readonly archives: EditorToolbarArchives;
  readonly connectionStatus: ConnectionStatus | null;
  readonly lantern: Lantern;

  constructor(options: EditorToolbarSourcesOptions);
  dispose(): void;
}
```

`mountStandalone` opens the sources from the launch it read and passes them to
`mount` as `context.toolbar`. `targets` is `null` inside a shell, which picks
the target itself, and for a share link. `archives` is
[`context.archives`](./Archives.md#editorarchives); the bar only uses it in
the Asset actions menu, so not without `targets`. `tags` is `null` for a
share link and
in offline mode, whose in-memory event store loses tags on reload.
`tags.viewing` is the tag of the launch. `connectionStatus` is the session's
[`connectionStatus`](./EditorSession.md#connectionstatus), `null` by default
and off a server.

`lantern` is the page's [`Lantern`](../../../../lantern/docs/Lantern.md). It
outlives the editor, so `dispose()` leaves it alone.

Both catalog sources listen to the session catalog until `dispose()`. The catalog
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
[switching](../boot/mountStandalone.md#switching-target-or-tag).

## EditorTargets

```ts
class EditorTargets extends Emitter<{ change: () => void; }> {
  readonly accepts: string;
  readonly current: string;
  get canRemoveCurrent(): boolean;

  [Symbol.iterator](): IterableIterator<AssetRecordData>;
  open(assetId: string): Promise<void>;
  renameCurrent(): Promise<void>;
  removeCurrent(): Promise<void>;
  dispose(): void;
}
```

### `[Symbol.iterator]()`

Yields the catalog records of the `accepts` kind, sorted by path. `change`
fires on every catalog change.

### `open(assetId)`

Navigates to the current version of `assetId` and resolves once it is open.
Opening `current` does nothing.

### `renameCurrent()`

Asks for a new name, prefilled with the name of `current`, and renames it in
its folder with its extension: `cave` to `cavern` turns
`maps/cave.voxelmap.json` into `maps/cavern.voxelmap.json`. The name is
trimmed. Nothing is sent when the dialog is dismissed or the name is empty or
unchanged.

### `removeCurrent()` and `canRemoveCurrent`

Asks to confirm, opens the next target by path (the previous one for the last
path), then deletes `current` from the catalog. Nothing changes when the user
cancels.

It rejects before asking in two cases:

- `LastTargetError` while `current` is the only asset of the `accepts` kind.
  `canRemoveCurrent` is `false` then.
- `TargetInUseError` while other assets use `current`. Its `dependents` lists
  their paths without extension.

Navigation goes through the required `navigator` option. Dialogs go through
the `browser` option, an `EditorTargetsBrowser` with `prompt(options)` and
`confirm(options)`, which defaults to the DOM dialogs.

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
