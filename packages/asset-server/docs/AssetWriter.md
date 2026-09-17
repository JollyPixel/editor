# AssetWriter

Use `backend.writer` to change assets. Each method appends an asset lifecycle
event before the backend updates the catalog and source.

```ts
writer.create(input: CreateAssetInput): Promise<Result<Event, Error>>
writer.update(input: UpdateAssetInput): Promise<Result<Event, Error>>
writer.rename(input: RenameAssetInput): Promise<Result<Event, Error>>
writer.remove(input: DeleteAssetInput): Promise<Result<Event, Error>>
```

Every input requires an event-store actor:

```ts
const actor = { type: "user", id: "alice" } as const;
```

## Create

```ts
const result = await backend.writer.create({
  path: "textures/grass.png",
  data: pngBytes,
  actor
});

const event = result.unwrap();
console.log(event.assetId);
```

```ts
interface CreateAssetInput {
  path: string;
  data: Uint8Array;
  actor: Actor;
  kind?: string;
  assetId?: string;
}
```

When `assetId` is omitted, the writer reuses the ID that
`.jollypixel/assets.json` records for the final path, unless a live asset
already holds that ID. Otherwise it generates a new one. It resolves the kind
from the registered path globs when `kind` is omitted.

With `onPathConflict: "suffix"`, a taken path gets `-2`, `-3`, ... inserted
before its first extension (`maps/world.voxelmap.json` becomes
`maps/world-2.voxelmap.json`) until the path is free. The default, `"reject"`,
returns `AssetPathConflictError`.

## Update, rename and remove

```ts
await backend.writer.update({ assetId, data: nextBytes, actor });
await backend.writer.rename({ assetId, to: "textures/ground.png", actor });
await backend.writer.remove({ assetId, actor });
```

## Errors

Every method returns failures as an error result and appends nothing:

- an unknown asset ID;
- a path that escapes the source root, or that names the `.jollypixel/` state
  directory: `AssetPathEscapeError`. Paths are
  [root-relative POSIX paths](../../asset-source/docs/AssetSource.md#paths);
- a `kind` passed to `create` that no handler registers:
  `UnknownAssetKindError`;
- a `create` (without `onPathConflict: "suffix"`) or `rename` target already
  used by another asset:
  `AssetPathConflictError`, carrying `path` and the occupying `assetId`.

The conflict check reads the desired state, so a path claimed by an event that
is not written to the source yet is already taken. Two assets can therefore
never share a file. A deleted asset frees its path.

Call `backend.flush(assetId)` when the caller must wait for the resulting
source write. The `alreadyProjected` input option is reserved for source-backed
reconciliation, where the bytes already exist in the source.
