# Archives

`context.archives` exports and imports the target as a `.zip` archive, the
same way on a server and offline. The toolbar's Asset actions menu and the
`archive` console namespace run the same flows.

```ts
class ModelEditor {
  static readonly archive = {
    fallbackName: "model", // default: the accepts kind
    resetWarning: "Every model stored here is deleted."
  };
}

await context.archives.download();
await context.archives.importFile(file);
```

## Methods

### download()

Saves the target with everything it references, named after its current
path's stem, or `fallbackName`.

### importFile(file, kind?)

- An archive rooted on an `accepts` asset is imported, then the page switches
  to that asset.
- An archive rooted on an [accepted](#dependencies) kind is imported and
  linked to the target. A single file ending with its `extension` is created
  in its `folder` and linked.
- An archive import asks how to handle assets that already exist, and does
  nothing when that question is dismissed.
- The page reloads when the import replaced assets that are open, since open
  documents do not see a replace.
- With `kind`, only that kind is imported.

Rejects before writing anything with `ArchiveRootError` when the root is
neither, and with `ArchiveImportDisabledError` on offline data that does not
persist.

### pickAndImport(kind?)

Opens a file picker, then runs `importFile()`. Browsers open the picker only
during a user action, such as a click or a console command submitted with
Enter.

## Dependencies

The assets the target references, such as the blocksets of a voxel map, can be
exported and imported on their own. The editor declares each kind it can link:

```ts
const release = context.archives.acceptDependency({
  kind: "blockset",
  extension: ".blockset.json",
  folder: "blocksets/"
}, ({ id }) => blocksets.link(id));

await context.archives.downloadAsset(blocksetId);
await context.archives.pickAndImport("blockset");
```

### acceptDependency(format, link): () => void

Lets `importFile()` and `pickAndImport()` take `format.kind` assets and link
them with `link`. The returned function stops accepting the kind.

### downloadAsset(assetId)

Saves that asset with everything it references.
