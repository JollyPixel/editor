# Voxel-map history

`VoxelEdits` is the undo source of a
[`VoxelDocument`](../../../voxel-renderer/docs/api/core/VoxelDocument.md);
`VoxelSyncClient` builds the one it sends with as `sync.edits`, which `SyncedVoxelMap` exposes as `map.edits`. Undo
itself is a `CommandHistory` from
[`@jolly-pixel/history`](../../../history/docs/CommandHistory.md); register
the edits in one with `voxelHistoryRegistration()`. Everything below is
exported from `@jolly-pixel/asset.voxel-map/client`.

```ts
import { CommandHistory } from "@jolly-pixel/history";
import { VoxelDocument } from "@jolly-pixel/voxel.renderer";
import {
  VoxelEdits,
  voxelHistoryRegistration
} from "@jolly-pixel/asset.voxel-map/client";

const document = new VoxelDocument({ layers: ["Ground"] });
const edits = new VoxelEdits(document);
const history = new CommandHistory<"map">({ limit: 10 });
history.register(voxelHistoryRegistration(edits, { scope: "map" }));

const stroke = history.open("map", "Paint");
document.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 });
stroke.commit();

history.undo("map");
```

## What is recorded

Local `setVoxel`, `removeVoxel`, `setVoxelBulk`, `removeVoxelBulk`,
`patchVoxels`, `transformLayer` and template placements on
[`VoxelWorld`](../../../voxel-renderer/docs/api/world/VoxelWorld.md). The cells they replaced become the
change's inverse, one `voxels-patched` command per layer. Recording starts with
the first `change` subscriber and stops with the last, so a document nobody
undoes pays nothing.

Not recorded: writes inside `world.unrecorded()` or `world.silently()`, layer,
object, block and blockset commands, direct `VoxelLayer` writes, and commands
applied with `document.apply()`.

`VoxelEdits` follows the document's `"command"` event. Every local world
command emits one `change` with origin `"local"`, and `edits.changeFor(command)`
returns that change to the listeners subscribed after it. `VoxelSyncClient`
builds its edits before it subscribes, so it sends each command with its
`basis` and matches the server's answers to it. A command applied
with `document.apply()` emits a `change` with the call's origin and
`clientId`, and no inverse. `document.load()` emits `reset` with `"load"`.

## Steps and refusals

- A step guards the cells its undo writes (world positions per layer) in a
  `VoxelKeySet`, and captures their packed values and partners.
- A peer's cell command refuses the steps on those cells. A peer's
  `layer-transformed`, `removed`, `merged` or `position-updated` refuses every
  step on that layer.
- A local layer move, merge or removal reports no cell. The next undo of a step
  whose cells it changed is refused as `changed` instead of writing at stale
  positions.
- When a step is filed, its patches are compacted into one `voxels-patched` per
  layer, the last write of each cell winning.

## API

```ts
type VoxelChange = CommandChange<VoxelWorldCommand, null>;

interface VoxelEditsDocument extends Pick<Emitter<BlockDocumentEvents<VoxelCommand>>, "on" | "off"> {
  readonly world: VoxelWorld;
}

class VoxelEdits implements HistorySource<VoxelWorldCommand, null> {
  constructor(document: VoxelEditsDocument);
  readonly world: VoxelWorld;
  readonly receipts: ChangeReceipts<VoxelChange>;
  changeFor(command: VoxelWorldCommand): VoxelChange | undefined;
  subscribe(event: "change", listener: (change: VoxelChange) => void): () => void;
  subscribe(event: "reset", listener: (cause: DocumentResetCause) => void): () => void;
  applyStep(command: VoxelWorldCommand, basis: number | undefined): VoxelChange | null;
  dispose(): void;
}
```

`applyStep()` writes a `voxels-patched` command through `world.patchVoxels()`
inside `world.unrecorded()`, so peers receive it, and returns its change. It
reads the inverse from the cells first and puts `basis` on the change for the
sync client to send. It returns `null` for any other command, an unknown layer
or a patch that changes nothing. Inside an outer `world.transaction()` the
write lands when the transaction closes.

`receipts` belong to the sync client that sends the document's commands, so
register `sync.edits` (or `map.edits`) rather than a second `VoxelEdits` when
the document is synced. `dispose()` stops following the document;
`VoxelSyncClient.destroy()` calls it.

```ts
function voxelHistoryRegistration<TScope extends string>(
  edits: VoxelEdits,
  options: { id?: string; scope: TScope; }
): HistoryRegistration<TScope, VoxelWorldCommand, null, VoxelKeySet, Int32Array>;

function voxelHistoryKeys(world: VoxelWorld): HistoryKeys<VoxelWorldCommand, null, VoxelKeySet, Int32Array>;
```

`id` defaults to `"voxels"`. A local change made outside an open step becomes
its own step in `scope`, labeled `"Edit voxels"`.

```ts
class VoxelKeySet {
  constructor(cells: Iterable<VoxelKeyCell>, layers?: Iterable<string>);
  readonly layers: ReadonlySet<string>;
  readonly cellCount: number;
  overlaps(other: VoxelKeySet): boolean;
  cells(): IterableIterator<VoxelKeyCell>;
}
```

Cells are stored as numbers per layer, not one string each. A key set built
with `layers` covers every cell of those layers: it overlaps any set holding
one of them.
