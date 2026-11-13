# Golem

One connection to a studio, with the agent token's identity. Every connection made with the same token shows the same name and color.

```ts
using golem = await Golem.connect({
  url: "http://localhost:5173",
  token: process.env.JOLLY_GOLEM_TOKEN
});
const scene = await golem.open(assetId, "scene");
```

## Options

```ts
interface GolemConnectOptions {
  url?: string | URL; // default: process.env.JOLLY_STUDIO_URL
  token?: string; // default: process.env.JOLLY_GOLEM_TOKEN
  timeoutMs?: number; // default: 10_000
}
```

`url` is the address the studio is served on. The socket path is derived from it, with `wss:` for an `https:` studio.

## Properties

```ts
class Golem {
  readonly url: string;
  readonly role: string;
  readonly catalog: CatalogClient;
  readonly chat: ChatChannel;
}
```

`url` is the studio address, normalized (`"http://localhost:5173/"`). `role` is the token owner's current role in the project.

`catalog` is the `CatalogClient` from `@jolly-pixel/asset-server/client`, already holding the first snapshot. Use it to list, create, rename and read assets, and for:

- `catalog.tag(assetId, name, message?)`: tags the asset's current state. Tag an asset before a scripted or bulk edit.
- `catalog.restore(assetId, name)`: brings the asset back to a tag. This is the only rollback: no one can undo a golem's edits with Ctrl+Z.
- `catalog.preview(assetId)`: the catalog preview image, or `null` when the kind renders none.

`chat` is the [`ChatChannel`](./ChatChannel.md): what people write in the studio's golem chat, and the golem's answers.

## Methods

### `Golem.connect(options?): Promise<Golem>`

Opens the socket, joins the golem chat, waits for the catalog and reads the studio's `project-manifest.json`, which lists the scene components its editors declare. The socket's own logs go to stderr, so stdout stays free for the script or the MCP protocol.

- Throws `TypeError` when neither the option nor the environment variable gives a URL or a token.
- Rejects with `GolemTokenRefusedError` when the studio does not know the token or it was revoked.
- Rejects with `StudioUnreachableError` when the catalog does not answer within `timeoutMs`, or when `ProjectManifest.fetch` from `@jolly-pixel/server` fails: no response, an error status, or a manifest this SDK cannot parse. `error.url` holds the normalized address and `error.cause` the `CatalogUnavailableError` or the manifest error.

### `open(assetId, kind?): Promise<GolemAsset>`

Joins the asset's room and resolves once its document is loaded. Opening an asset that is already open returns the same [`GolemAsset`](./GolemAsset.md). `kind` is one kind or a list of kinds, such as `["pixelart", "blockset"]`, and narrows the return type: `"scene"` to `SceneAsset`, `"script"`, `"shader"` and `"text"` to `TextAsset`, `"voxelmap"` to `VoxelMapAsset`, `"blockset"` to `BlocksetAsset`, `"voxelmodel"` to `VoxelModelAsset`, `"pixelart"` to `PixelArtAsset`.

- Throws `UnknownAssetError` when the catalog has no such asset.
- Throws `KindMismatchError`, before joining the room, when the asset is not of the given `kind`. `error.kind` holds the asset's kind.
- Throws `UnsupportedKindError` for a kind the SDK cannot open. `GOLEM_KINDS` lists the ones it can: `scene`, `script`, `shader`, `text`, `voxelmap`, `blockset`, `voxelmodel` and `pixelart`.

### `close(assetId): void`

Closes an asset the caller opened. An asset another open asset still needs stays open until that one closes: a voxel map holds the blocksets it links. `asset.close()` closes it at once.

Throws `AssetClosedError` when the caller did not open the asset, including one only a voxel map opened.

### `activity(asset, { label, progress? }): void`

Publishes what the golem is doing on that asset's room, for people in its editor, and mirrors it with the asset id on the golem chat, whose pane lists every agent's work. `label` holds 1 to 200 characters and `progress` runs from 0 to 1, as `peerActivitySchema` from `@jolly-pixel/network` checks. Publishing on another asset clears the previous one, and closing the asset clears it.

Throws `AssetClosedError` when `asset` is not open on this golem.

### `clearActivity(): void`

Clears the published activity.

### `peers(): IterableIterator<Peer>`

The people and agents connected to the studio, without the golem itself. Each `Peer` from `@jolly-pixel/network/client` carries its `role`, its `profile` (`username`, `via` for an agent) and its `presence`.

### `assets(): IterableIterator<GolemAsset>`

The assets this golem has open.

### `status(): StudioStatus`

A JSON-ready snapshot: `url`, `role`, `peers` as `{ name, role, via? }`, the open `assets` with their `kind`, `unanswered` count and peers, and `unreadChat`, the number of messages `chat.next()` would return. `jolly-golem status` prints it.

### `dispose(): void`

Closes every open asset, the chat and the socket. `using` calls it.

## Revoked tokens

When the owner revokes the token or loses their account, the studio refuses the golem. Every unanswered command then fails with `GolemTokenRefusedError`, and so do every later `apply` and every `open` still waiting for its document.

When the owner only changes role, the golem reconnects with the new role. Commands the new role may not send fail with `CommandDeniedError`.
