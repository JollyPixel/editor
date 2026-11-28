# GolemAsset

The base class of one open asset. A kind subclasses it with methods that build the kind's commands and send them through `apply`. The base class checks each batch against the kind's command schema and the golem's rights, applies it through the kind's `localEdits`, and tracks the studio's answers.

```ts
import { GolemAsset } from "@jolly-pixel/golem.kit";
import type { PeerMetadata } from "@jolly-pixel/network/client";

export class EnvironmentAsset extends GolemAsset<
  EnvironmentCommand,
  SyncedEnvironmentDocument
> {
  read(): EnvironmentFile {
    return structuredClone(this.synced.document.file);
  }

  async change(input: EnvironmentChange): Promise<void> {
    await this.apply([{ action: "environment-changed", set: sectionsOf(input) }]);
  }

  protected focus(): PeerMetadata | null {
    return null;
  }
}
```

A subclass declares no constructor: `golemKind` builds it from the opening and the document kind. Build helpers in field initializers, which run once `synced` and `studio` are set:

```ts
#components = SceneComponentTypes.parse(this.studio.kindPackages);
```

## What a subclass implements

- `read(): unknown` returns the document as JSON.
- `focus(commands): PeerMetadata | null` returns the presence published after a batch is applied, so people see what the golem is editing. `null` publishes nothing.

Two hooks are optional:

- `guard(commands)` runs after the schema and rights checks, before anything is applied. Throw to stop the batch, such as a `LockedByPeerError` when a peer holds a lock on what it edits.
- `loaded()` runs once the document has loaded, before `ready` resolves.

## What a subclass reads

- `synced`: the kind's `SyncedDocument` for the asset's room.
- `studio`: an `AssetStudio`, which holds:
  - `catalog`, the studio catalog's `record`, `records` and `dependencies`;
  - `kindPackages`, the kind packages in the project manifest as `unknown[]`, so a kind parses the fields it reads;
  - `open(assetId, kind)`, which opens another asset through the same golem, as a voxel map opens its blocksets.
- `applyInBatches(commands)` sends a list longer than `MAX_BATCH_COMMANDS` (500) as several batches.

`apply`, `settled`, `peers` and `close` are the public side scripts call. `@jolly-pixel/golem` documents them and their errors.

## Resolving names

`resolveEntry(entry, nameOrId, entries, describe?)` returns the entry whose `id` is `nameOrId`, or else the only one whose `name` is. It throws `UnknownEntryError` when no entry or several match. `describe` labels each candidate in that error, by default with its `id`.

```ts
const material = resolveEntry("material", nameOrId, materials);
```

## Errors

Kinds throw these errors from the kit so that every kind reports the same failure with the same message:

- `UnknownAssetError`: the catalog has no such asset.
- `KindMismatchError`: the asset has another kind than the one asked for.
- `LockedByPeerError(peer, target)`: a peer is editing `target`.
- `UnknownEntryError`: thrown by `resolveEntry`.
