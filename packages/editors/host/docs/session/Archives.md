# Archives

Export and import of `.zip` asset archives through the catalog room, the same
way on a server and [offline](../editor/bootStandalone.md#offline-workspace).

## SessionArchive

`session.archive` exports and imports archives.

```ts
const blob = await session.archive.export(session.target.record.id);

const plan = await session.archive.plan(file);
const report = await session.archive.import(file, {
  onConflict: plan.live.length > 0 ? "replace" : "keep"
});
```

### canImport

`false` on a workspace that does not persist, where the reload after an
import would lose it.

### export(assetId?)

The asset with everything it references, or the whole workspace.

### plan(file)

The `ImportPlan`: which ids are `live` or `fresh`, incompatible kinds, and the
`sharedDependents` a replace would affect. Writes nothing.

### import(file, { onConflict })

Resolves with the `ImportReport`. `"copy"` duplicates the archive under new
ids. Rejects with `ArchiveImportDisabledError` when `canImport` is `false`.

An editor cannot remount after an import: reload onto
`?target=<report.root.id>`.

## EditorArchives

The export, import and reset flows behind an editor's buttons, built for the
session's target and `accepts` kind.

```ts
const archives = session.archives({
  fallbackName: "model",
  resetWarning: "Every model stored here is deleted."
});

await archives.download();
await archives.importFile(file);
await archives.reset();
```

### canImport, canReset and volatile

Whether to offer import and reset, and whether edits are lost on reload.

### download()

Saves the target as its path's stem with `.zip`, or `fallbackName`. The path
is read on each call, so a renamed target downloads under its new name.

### importFile(file)

Rejects with `ArchiveRootError` when the archive root is not an `accepts`
asset, before anything is written. Asks how to handle existing assets with
`askImportConflictPolicy(plan)`, imports, then reloads onto the root. Does
nothing when the question is dismissed.

### pickAndImport()

Opens a `.zip` file picker, then runs `importFile()`. Browsers open the
picker only during a user action, such as a click or a console command
submitted with Enter.

### reset()

Asks to confirm `resetWarning`, resets the workspace and reloads.

The `browser` option, an `EditorArchiveBrowser`, replaces downloads, file
picking, dialogs and navigation. It defaults to the DOM and
`window.location`.

## ArchiveActions

`<jolly-archive-actions>` renders the buttons of an `EditorArchives`, the
notice of a volatile workspace and the error of the last failed flow.
Importing `@jolly-pixel/editor.host/ui` defines it.

```ts
import "@jolly-pixel/editor.host/ui";

html`<jolly-archive-actions .archives=${archives}></jolly-archive-actions>`;
```

## archiveConsole

A [console feature](../../../../console/docs/features.md) registering
`/archive.export`, `/archive.import` (when `canImport`) and `/archive.reset`
(when `canReset`).

```ts
registerConsoleFeatures(commands, [archiveConsole], { archives });
```
