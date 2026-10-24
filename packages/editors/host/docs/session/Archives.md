# Archives

Export and import of `.zip` asset archives through the catalog room, the same
way on a server and [offline](../boot/bootStandalone.md#offline-mode).

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

`false` on offline data that does not persist, where the reload after an
import would lose it.

### export(assetId?)

The asset with everything it references, or the whole catalog.

### plan(file)

The `ImportPlan`: which ids are `live` or `fresh`, incompatible kinds, and the
`sharedDependents` a replace would affect. Writes nothing.

### import(file, { onConflict })

Resolves with the `ImportReport`. `"copy"` duplicates the archive under new
ids. Rejects with `ArchiveImportDisabledError` when `canImport` is `false`.

Documents already open do not see the assets an import replaced: reload onto
`?target=<report.root.id>` when `report.replaced` is not empty.

## EditorArchives

The export, import and reset flows behind the `archive` console commands and
the toolbar's [Asset actions menu](./EditorToolbar.md#properties).
The host builds one per mount for the target and gives it to the editor as
[`context.archives`](../boot/mountStandalone.md#editor-context). The editor
definition names its labels:

```ts
class ModelEditor {
  static readonly archive = {
    fallbackName: "model", // default: the accepts kind
    resetWarning: "Every model stored here is deleted."
  };
}

await context.archives.download();
await archives.importFile(file);
await archives.reset();
```

### canImport and canReset

Whether to offer import and reset.

### download()

Saves the target as its path's stem with `.zip`, or `fallbackName`. The path
is read on each call, so a renamed target downloads under its new name.

### importFile(file)

Rejects with `ArchiveRootError` when the archive root is not an `accepts`
asset, before anything is written. Asks how to handle existing assets with
`askImportConflictPolicy(plan)` and imports. Then it
[switches](../boot/mountStandalone.md#switching-target-or-tag) to the root, or
reloads onto it when the import replaced assets. Does nothing when the
question is dismissed.

### pickAndImport()

Opens a `.zip` file picker, then runs `importFile()`. Browsers open the
picker only during a user action, such as a click or a console command
submitted with Enter.

### reset()

Asks to confirm `resetWarning`, resets the offline data and reloads.

The `browser` option, an `EditorArchiveBrowser`, replaces downloads, file
picking, dialogs and reloads. It defaults to the DOM and `window.location`.

## Console

The host registers `/archive.export`, `/archive.import` (when `canImport`)
and `/archive.reset` (when `canReset`) for every editor.
