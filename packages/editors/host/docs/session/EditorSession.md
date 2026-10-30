# EditorSession

The editor's view of its target asset on the asset server. The host opens it
and passes it to `mount` as `context.session`; the host also disposes it.

```ts
static async mount(context: EditorContext): Promise<MyEditor> {
  const { session } = context;
  const target = session.targetLease(MY_DOCUMENT_KIND);

  return new MyEditor(session, target.document);
}
```

## Properties

```ts
readonly identity: PeerIdentity;
readonly catalog: CatalogClient;
readonly assets: AssetLeases;
readonly target: AssetRoomLease;
```

- `identity` is the local peer: username and presence color.
- `catalog` lists every asset of the project and follows its changes.
- `assets` is the [`AssetLeases`](../lease/AssetLeases.md) where panels open
  and release their own leases.
- `target.record` is the catalog record the session opened.

## Methods

### targetLease(kind)

The target document as a typed [`AssetLease`](../lease/AssetLeases.md#leases).
Pass the same kind object as the definition's `kinds`. On a `?tag=` page it
reads that tag, and the server grants only `read` there.

```ts
const target = session.targetLease(VOXEL_MAP_KIND_OBJECT);
paint(target.document);
```

### lease(kind, assetId)

A typed lease on another asset, held until the session is disposed. Use it
for a document the editor needs for its whole mount, such as a model's
texture.

```ts
const texture = session.lease(PIXEL_ART_KIND_OBJECT, reference.id);
```

The session releases both kinds of lease; the editor does not. Both throw
once the session is disposed.

### pickAsset(options): Promise<AssetReferenceData | null>

Opens a dialog listing the catalog assets of `kinds` as a searchable folder
tree. Resolves with the picked asset, or `null` when the user cancels or the
session is disposed while it is open. Rejects once the session is disposed.

```ts
interface AssetPickOptions {
  kinds: Iterable<AssetKindDescriptor>;
  title: string;
  current?: AssetReferenceData | null; // selected when still in the catalog
  accepts?: (reference: AssetReferenceData) => boolean;
}

const map = await session.pickAsset({
  kinds: [VOXEL_MAP_ASSET],
  title: "Pick a voxel map"
});
```

`accepts` leaves out the assets it returns `false` for.
