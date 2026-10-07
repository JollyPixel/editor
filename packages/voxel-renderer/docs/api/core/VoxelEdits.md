# VoxelEdits

The undo source of a [`VoxelDocument`](./VoxelDocument.md), exposed as
`document.edits`. Undo itself is a `CommandHistory` from
[`@jolly-pixel/history`](../../../../history/docs/CommandHistory.md); register
the document in one with `voxelHistoryRegistration()`.

```ts
import { CommandHistory } from "@jolly-pixel/history";
import {
  VoxelDocument,
  voxelHistoryRegistration
} from "@jolly-pixel/voxel.renderer";

const document = new VoxelDocument({ layers: ["Ground"] });
const history = new CommandHistory({ scopes: ["map"], limit: 10 });
history.register(voxelHistoryRegistration(document, { scope: "map" }));

const stroke = history.open("map", "Paint");
document.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 });
stroke.commit();

history.undo("map");
```

## What is recorded

Local `setVoxel`, `removeVoxel`, `setVoxelBulk`, `removeVoxelBulk`,
`patchVoxels`, `transformLayer` and template placements on
[`VoxelWorld`](../world/VoxelWorld.md). The cells they replaced become the
change's inverse, one `voxels-patched` command per layer. Recording starts with
the first `change` subscriber and stops with the last, so a document nobody
undoes pays nothing.

Not recorded: writes inside `world.unrecorded()` or `world.silently()`, layer,
object, block and blockset commands, direct `VoxelLayer` writes, and commands
applied with `document.apply()`.

Every local world command emits one `change` with origin `"local"`, before the
document's `"command"` event for it, and `edits.changeOf(command)` returns that
change, so a sync client can send the command with its `basis` and match the
server's answers to it. A command applied
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

type VoxelEditsDocument = Pick<Emitter<BlockDocumentEvents<VoxelCommand>>, "on">;

class VoxelEdits implements HistorySource<VoxelWorldCommand, null> {
  constructor(world: VoxelWorld, document: VoxelEditsDocument);
  readonly receipts: ChangeReceipts<VoxelChange>;
  changeOf(command: VoxelWorldCommand): VoxelChange | undefined;
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

`receipts` belong to the sync client that sends the document's commands.
`VoxelDocument` builds its `edits` from its world and itself;
`document.dispose()` calls `dispose()`.

```ts
function voxelHistoryRegistration<TScope extends string>(
  document: Pick<VoxelDocument, "edits" | "world">,
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
