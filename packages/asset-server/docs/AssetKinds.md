# Asset kinds

An `AssetKindHandler` defines how one asset type is recognized, folded into
state and serialized.

```ts
interface AssetKindHandler<TState = unknown> {
  readonly kind: string;
  readonly match: readonly string[];
  readonly snapshot?: SnapshotPolicy;

  create(assetId: string): TState;
  apply(state: TState, event: Event): void;
  serialize(state: TState): Promise<Uint8Array>;
  createExtension?(binding: AssetRoomBinding<TState>): Extension;
}
```

Handlers are checked in registration order. `match` contains globs matched
against root-relative POSIX paths. The built-in `binary` handler receives any
path that no registered handler claims.

`apply` receives lifecycle events and domain events from the asset stream.
`serialize` returns the bytes stored by the asset source. A handler that
supports live editing provides `createExtension`; other kinds have no dynamic
editing room.

`apply` must reset the existing `TState` in place for `asset.created`,
`asset.updated` and `asset.deleted`. Each event is a complete checkpoint.
Replay creates a fresh state, resumes at the newest checkpoint and folds later
events. Reassigning the `state` parameter has no effect because `apply` returns
`void` and the store retains the value returned by `create`.

`TState` defaults to `unknown`, so a handler declared without it must narrow
its own state before use. Pass the state type to keep `create`, `apply` and
`serialize` checked against each other.

## Reading lifecycle payloads

`event.eventData` is typed `unknown` by the event store, because the store
holds any domain. Narrow it with `isAssetEvent` rather than asserting a
shape: it validates the payload against the event type and returns `false`
for domain events and for lifecycle events whose payload does not match.

```ts
apply(state: MyState, event: Event): void {
  if (isAssetEvent(event) && event.eventType === ASSET_UPDATED) {
    // eventData is AssetWriteData here
    state.bytes = decodeContent(event.eventData.content);
  }
}
```

Payloads read straight from persistence are parsed JSON, so a corrupt row
would otherwise reach the fold unchecked.

## Snapshot policy

```ts
interface SnapshotPolicy {
  delay?: number;
  maxDelay?: number;
}
```

`delay` is the quiet period after the latest domain event. `maxDelay` limits
the time since the first unsnapshotted event. Backend defaults are `2_000` ms
and `30_000` ms. A handler can override either value through `snapshot`.

`delay: 0` schedules the snapshot for the next timer turn. Lifecycle events
do not schedule snapshots.

## Registry

```ts
const kinds = new AssetKindRegistry([pixelArtHandler]);

kinds.register(voxelHandler);
kinds.resolve("textures/grass.png");
kinds.get("pixelart");
```

Registering the same kind twice throws. The reserved `binary` fallback cannot
be replaced.

## Built-in kinds

`binary` is the reserved fallback. `texture` is a shipped handler that claims
image files so a runtime `AssetType` of the same name can resolve them:

```ts
import { textureAssetHandler } from "@jolly-pixel/asset-server";

const kinds = new AssetKindRegistry([textureAssetHandler()]);
```

Its state is the file's bytes, exactly like `binary`, and it has no
`createExtension`, so texture assets get no editing room. The kind exists to
name the record: `AssetCatalog.resolve()` rejects a record whose kind does not
match its reference, and nothing on the browser side loads `binary`. Pass
`match` to narrow the globs from the default image extensions.

## Kinds shipped by other packages

Two handlers live with the domain they serialize rather than here, because
asset-server does not depend on the renderers:

```ts
import { pixelArtAssetHandler } from "@jolly-pixel/pixel-draw.renderer/asset/index.ts";
import { voxelMapAssetHandler } from "@jolly-pixel/voxel.renderer/asset/index.ts";

await createAssetBackend({
  source,
  eventStore,
  handlers: [
    pixelArtAssetHandler(),
    voxelMapAssetHandler(),
    textureAssetHandler()
  ]
});
```

Both take `@jolly-pixel/asset-server` as an optional peer dependency, so a
browser-only consumer of either renderer never installs it.

## Writing an editable kind

A kind with live editing has two halves that must not overlap: `apply` is the
only writer of state, and `createExtension` returns a room that appends
without writing. The room reads state to arbitrate, appends the accepted
command, and broadcasts once the append lands:

```ts
async onMessage(clientId, payload, context) {
  const accepted = this.#arbiter.accept(this.#state.buffer, payload);
  if (accepted === null) {
    return;
  }

  // The append folds through `apply` before it resolves, so the state is
  // current by the time peers hear about the change.
  const appended = await context.eventStore.append({
    assetType: this.name,
    assetId: this.#assetId,
    eventType: MY_COMMAND,
    eventData: accepted
  });
  if (appended) {
    context.room.broadcast({ type: "command", data: accepted });
  }
}
```

A room that also mutated the state would apply every command twice: once
itself and once through the fold. Absolute writes survive that, but a command
carrying a delta does not. `voxel-map`'s `offset-updated` is exactly such a
command, which is why both shipped kinds keep the halves separate.

`apply` must never throw. Its event is already persisted, so a fold that
aborts would break every later replay. Both shipped handlers catch, log and
keep the last good state.
