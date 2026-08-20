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
