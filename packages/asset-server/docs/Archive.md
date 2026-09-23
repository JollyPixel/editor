# Archive

An archive is a `.zip` holding one asset with everything it references, or a
whole workspace. It carries serialized content only, never the event history.

```ts
import {
  exportAssetArchive,
  importAssetArchive,
  planAssetImport,
  readAssetArchive
} from "@jolly-pixel/asset-server/backend";

const bytes = await exportAssetArchive(backend, { root: mapId });

const archive = readAssetArchive(bytes).unwrap();
const plan = planAssetImport(otherBackend, archive).unwrap();
const report = (await importAssetArchive(otherBackend, archive, {
  onConflict: plan.live.length > 0 ? "replace" : "keep",
  actor
})).unwrap();
```

The functions are browser-safe and take any `AssetBackend`. Over the network
the same operations run through the [catalog room](./Catalog.md#archives).

## Format

Each asset sits at its workspace path, next to one manifest at the root.

```
bundle.json
maps/overworld.voxelmap.json
textures/block.pixelart
```

```json
{
  "version": 1,
  "root": { "id": "…", "kind": "voxel-map" },
  "assets": [
    { "id": "…", "kind": "pixel-art", "path": "textures/block.pixelart" },
    { "id": "…", "kind": "voxel-map", "path": "maps/overworld.voxelmap.json" }
  ],
  "missing": [{ "id": "…", "kind": "pixel-art" }]
}
```

- `assets` is ordered dependencies first, root last. Import follows that order.
- `root` is absent for a whole-workspace archive.
- `missing` lists references whose asset no longer exists. Export does not
  fail on them.
- An archive keeps asset ids: the same id means the same asset.
- No `.jollypixel/` entry is ever written.

## exportAssetArchive

```ts
interface ExportAssetArchiveOptions {
  root?: string;
}

exportAssetArchive(
  backend: ArchiveBackend,
  options?: ExportAssetArchiveOptions
): Promise<Uint8Array>
```

Flushes the root and every asset of its closure before reading them, so
pending edits of a dependency are part of the archive. Without `root` the
whole workspace is exported. An unknown `root` rejects with
`AssetArchiveError`.

## readAssetArchive

```ts
interface ReadAssetArchiveOptions {
  maxEntryBytes?: number;
  maxBytes?: number;
}

readAssetArchive(
  bytes: Uint8Array,
  options?: ReadAssetArchiveOptions
): Result<AssetArchive, AssetArchiveError>
```

Pure: decodes and validates without a back-end. `AssetArchive` holds `root`,
`missing` and `assets`, each asset with its decoded `data`.

| `rejection` | Cause |
|---|---|
| `corrupt` | The bytes are not a readable ZIP. |
| `manifest-missing` / `manifest-invalid` / `unsupported-version` | `bundle.json` is absent, malformed, names a root outside `assets`, or has another `version`. |
| `unsafe-path` | An asset path is absolute, escapes the workspace or is not normalized. |
| `reserved-path` | An entry or asset path is under `.jollypixel/`. |
| `duplicate` | An asset id is listed twice. |
| `missing-entry` | A listed asset has no ZIP entry. |
| `unexpected-entry` | A file is absent from the manifest. |
| `too-large` | An entry exceeds `maxEntryBytes` (16 MiB) or the archive `maxBytes` (64 MiB), decoded. |

Directory entries, `__MACOSX/` and `.DS_Store`, which an operating system
adds when re-zipping, are ignored.

## planAssetImport

```ts
planAssetImport(backend, archive): Result<ImportPlan, AssetArchiveError | UnknownAssetKindError>
```

The read-only import pre-flight. Every kind must be registered, and every
asset is loaded into a throwaway state of its kind: a document that does not
load rejects the archive with `unreadable-asset` and the `assetId` at fault.
A live id of another kind is listed in `incompatible`. Keep and replace
reject that collision; import as copy accepts it.

```ts
interface ImportPlan {
  readonly root?: AssetReferenceData;
  readonly live: readonly AssetArchiveEntry[];
  readonly fresh: readonly AssetArchiveEntry[];
  readonly sharedDependents: readonly SharedDependents[];
  readonly incompatible: readonly AssetArchiveEntry[];
}

interface SharedDependents extends AssetArchiveEntry {
  readonly dependents: readonly AssetArchiveEntry[];
}
```

`live` contains existing IDs at their current paths; `fresh` contains IDs
the workspace does not know. `sharedDependents` identifies existing assets
referenced from outside the archive. Replacing one changes what those
dependents see.

## importAssetArchive

```ts
interface ImportAssetArchiveOptions {
  onConflict: "replace" | "keep" | "copy";
  actor: Actor;
}

importAssetArchive(
  backend: ArchiveBackend,
  archive: AssetArchive,
  options: ImportAssetArchiveOptions
): Promise<Result<ImportReport, AssetImportError>>
```

Runs the plan first: nothing is written when it fails. `onConflict` applies
once to the whole archive, never per asset, since a bundle is one consistent
snapshot.

- A fresh id is created at the archive path, under the archived id. An
  occupied path gets a `-2` suffix; references hold since they use ids.
- A live id with `"replace"` has its content updated. It keeps its current
  path and its open rooms reload.
- A live id with `"keep"` is skipped.
- `"copy"` gives every archived asset a new id, suffixes occupied paths,
  and rebinds references between archived assets. The report root uses its
  new id. Kinds with internal references must provide `rebind`.

The function resolves once the written content reached the source, so a
caller may reload right after it.

`ImportReport` lists `created`, `replaced`, `kept` and `failed` entries, each
with its id, kind and final path. A `failed` entry carries the writer
`reason`; the other assets are still imported.
