# GolemAsset

An open asset. It sends raw kind commands and tells whether the studio accepted them. Get one from `golem.open` ([Golem](./Golem.md)).

```ts
const scene = await golem.open(assetId, "scene");
await scene.apply([
  { action: "actor-renamed", id: actorId, name: "Player" },
  { action: "actor-transformed", id: actorId, transform: { position: { x: 0, y: 1, z: 0 } } }
]);
await scene.settled();
```

## Properties

```ts
class GolemAsset {
  readonly id: string;
  readonly kind: string;
  readonly unanswered: number; // commands sent and not yet confirmed or refused
  readonly closed: boolean; // true once close() ran
}
```

## Methods

### `apply(commands): Promise<void>`

Checks every command against the kind's schema and the golem's rights, applies them to the local document, then sends them. The SDK adds the command header (`clientId`, `seq`, `timestamp`).

- Throws `CommandInvalidError`, with the command's `index`, when a command does not match the schema or the document cannot apply it as it is now. Nothing is sent when the schema check fails. When the document refuses a command, the commands before it in the batch are already sent.
- Throws `CommandDeniedError` when the owner's role may not write this asset.
- Throws `LockedByPeerError` when a peer holds a lock on what the batch edits, for kinds whose editor has locks.
- Throws `RangeError` for a batch over `MAX_BATCH_COMMANDS` (500).
- Waits before sending while the batch would bring the unanswered commands over `MAX_UNANSWERED_COMMANDS` (1,000), so a runaway loop cannot flood the room. The rights and lock checks run after the wait, against the asset as it is then.

### `settled(): Promise<void>`

Resolves once the studio has answered every sent command.

- Rejects with `CommandRefusedError` when the studio refused some of them, usually because a peer changed the same thing first. `error.commands` holds the refused commands. Their local effect is already rolled back.
- Rejects with `CommandDeniedError` when the studio denied a command, for example after the owner lost write access.

### `peers(): IterableIterator<Peer>`

The people and agents in this asset's room, without the golem itself.

### `read(): unknown`

The document as JSON.

### `close(): void`

Leaves the room. Pending and later calls fail with `AssetClosedError`.

## Kinds

Each kind's class comes from the `golem` entry of its asset package, which documents it in its `docs/Golem.md` (served as `jollypixel://docs/<package>/Golem.md`, such as `jollypixel://docs/asset.scene/Golem.md`):

- `SceneAsset`: `@jolly-pixel/asset.scene/golem`.
- `TextAsset`, for `script`, `shader` and `text`: `@jolly-pixel/asset.script/golem`.
- `VoxelMapAsset` and `BlocksetAsset`: `@jolly-pixel/asset.voxel-map/golem`.
- `VoxelModelAsset`: `@jolly-pixel/asset.voxel-model/golem`.
- `PixelArtAsset` and `PixelSurface`: `@jolly-pixel/asset.pixel-art/golem`.
- `EnvironmentAsset`: `@jolly-pixel/asset.environment/golem`.

Import a class or its types from there, such as `import type { SceneAsset } from "@jolly-pixel/asset.scene/golem"`.

The golem looks up each kind package the studio's `project-manifest.json` lists in the `projectRoot` (`--project`), then in its own dependencies, then in the checkout's `packages/assets/`. A package without a `jollypixel.golem` export adds no kind. When a package fails to load, opening one of its kinds throws `UnsupportedKindError` with the load error as its `cause`.
