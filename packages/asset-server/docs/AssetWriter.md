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

The backend generates an asset ID when `assetId` is omitted. It resolves the
kind from the registered path globs when `kind` is omitted.

## Update, rename and remove

```ts
await backend.writer.update({ assetId, data: nextBytes, actor });
await backend.writer.rename({ assetId, to: "textures/ground.png", actor });
await backend.writer.remove({ assetId, actor });
```

These operations return an error result when the asset ID is unknown. Paths
are root-relative POSIX paths. Backslashes are normalized, and paths that
escape the source root throw `AssetPathEscapeError`.

Call `backend.flush(assetId)` when the caller must wait for the resulting
source write. The `alreadyProjected` input option is reserved for source-backed
reconciliation, where the bytes already exist in the source.
