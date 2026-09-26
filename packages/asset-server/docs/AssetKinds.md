# Asset kinds

An `AssetKindHandler` defines how one asset type is recognized, folded into
state and serialized.

```ts
interface AssetKindHandler<TState = unknown, TCommand = unknown> {
  readonly kind: string;
  readonly extensions: Readonly<Record<string, string>>;
  readonly match?: readonly string[];
  readonly snapshot?: SnapshotPolicy;
  readonly commands?: AssetCommands<TState, TCommand>;

  create(assetId: string): TState;
  load(state: TState, content: Uint8Array): void;
  clear(state: TState): void;
  serialize(state: TState): Promise<Uint8Array>;
  dependencies?(state: TState): readonly AssetReferenceData[];
  rebind?(state: TState, idMap: ReadonlyMap<string, string>): void;
}

interface AssetCommands<TState = unknown, TCommand = unknown> {
  readonly eventType: string;
  readonly protocol: MessageProtocol;

  apply(state: TState, command: TCommand): void;
  live?(binding: AssetRoomBinding<TState>): AssetLiveProtocol<TCommand>;
}
```

`extensions` maps each file extension the kind claims to the content type it
is served with. Keys start with a dot and may span several dots
(`.voxelmap.json`). A kind claims a root-relative POSIX path that ends with one
of its extensions and, when `match` is set, also matches one of those globs.
`match` can only narrow the claim, never widen it.

Handlers are checked in registration order. The built-in `binary` handler
receives any path that no registered handler claims.

`serialize` returns the bytes stored by the asset source. A kind that supports
live editing provides `commands.live`; other kinds have no dynamic editing
room.

`dependencies` lists the assets a state references, such as the tilesets of
a voxel map. The writer records them on every `asset.created` and
`asset.updated` event, so it runs on every lifecycle write. A kind that
references nothing omits it. See [dependency edges](./Catalog.md#dependency-edges).

`rebind` changes references to IDs present in `idMap` when importing an
archive as a copy. The handler mutates the loaded state before serialization.
Kinds with no references can omit it.

Import the handler contract from `@jolly-pixel/asset-server/kinds`. It exposes
the handler and live protocol types, `foldAssetEvent`, the built-in handlers
and the asset event helpers, without the back-end, catalog or HTTP modules the
root entry loads:

```ts
import {
  foldAssetEvent,
  type AssetKindHandler
} from "@jolly-pixel/asset-server/kinds";
```

## Folding

Handlers never read raw events. `foldAssetEvent` parses each event and calls
the matching hook:

```ts
function foldAssetEvent<TState, TCommand>(
  handler: AssetKindHandler<TState, TCommand>,
  state: TState,
  event: Event
): void;
```

| Event | Hook |
|---|---|
| `asset.created`, `asset.updated` | `load(state, content)` with the decoded bytes |
| `asset.deleted` | `clear(state)` |
| `commands.eventType` | `commands.apply(state, command)` once the payload matches `commands.protocol` |
| anything else | none |

A lifecycle event that fails `parseAssetEvent` is ignored, since the projector
already reports it. A command payload that does not match `commands.protocol`
is ignored.

`load` and `clear` reset the existing `TState` in place, because each lifecycle
event is a complete checkpoint. Replay creates a fresh state, resumes at the
newest checkpoint and folds later events. Reassigning the `state` parameter has
no effect: the store retains the value returned by `create`.

`foldAssetEvent` propagates whatever a hook throws. `AssetStateStore` catches
it, logs `asset event not folded` at error level and moves on, so a corrupt row
neither aborts a replay nor escapes the append of a live command. Handlers need
no `try`/`catch` of their own.

`load` throws `InvalidAssetDocumentError` when the content is not a document of
its kind. The error carries the handler's `kind`; its message names the reason
and `cause` keeps the underlying decoder error. `AssetStateStore` logs this
error at warn level, so corrupt stored content stays apart from handler bugs,
which keep the error level:

```ts
import { InvalidAssetDocumentError } from "@jolly-pixel/asset-server/kinds";

throw new InvalidAssetDocumentError("voxelmodel", "content is not JSON", {
  cause
});
```

`TState` defaults to `unknown`, so a handler declared without it must narrow
its own state before use. Pass the state type to keep every hook checked
against the others.

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

Registering the same kind twice throws, as does a kind with no `extensions`
or with an extension lacking its leading dot. The reserved `binary` fallback
cannot be replaced.

`kinds.contentTypes()` merges the `extensions` of every registered kind,
later registrations winning on a shared extension.

## Descriptor

```ts
interface AssetKindDescriptor {
  kind: string;
  label: string;
  icon?: AssetKindIcon;
}

interface AssetKindIcon {
  svg: string;
  tone?: string;
}
```

A descriptor is the kind's presentation as plain data: a label and an icon
whose `svg` holds the children of a 24x24 view box. A host that lists or
opens assets reads it without loading the handler, so a descriptor can also
come from a manifest. Packages export one beside their handler
(`PIXEL_ART_ASSET`, `VOXEL_MAP_ASSET`, `VOXEL_MODEL_ASSET`).

## Built-in kinds

`binary` is the reserved fallback. `texture` is a shipped handler that claims
image files so a runtime `AssetType` of the same name can resolve them:

```ts
import { textureAssetKind } from "@jolly-pixel/asset-server";

const kinds = new AssetKindRegistry([textureAssetKind()]);
```

Its state is the file's bytes, exactly like `binary`, and it has no
`commands`, so texture assets get no editing room. The kind exists to
name the record: `AssetCatalog.resolve()` rejects a record whose kind does not
match its reference, and nothing on the browser side loads `binary`. It claims
`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif` and `.bmp`; pass `match` to narrow
that claim, for example to `["textures/**"]`.

## Kinds shipped by other packages

Handlers for editable formats live with the domain they serialize rather than
here, because asset-server does not depend on the renderers. Each claims a
fixed extension, exported next to its kind (`PIXEL_ART_EXTENSION`,
`TILESET_EXTENSION`, `VOXEL_MAP_EXTENSION`, `VOXEL_MODEL_EXTENSION`), so the
editors that create
documents and the server agree on it:

```ts
import { pixelArtAssetKind } from "@jolly-pixel/asset.pixel-art";
import {
  tilesetAssetKind,
  voxelMapAssetKind
} from "@jolly-pixel/asset.voxel-map";

await createAssetBackend({
  source,
  eventStore,
  handlers: [
    pixelArtAssetKind(),
    tilesetAssetKind(),
    voxelMapAssetKind(),
    textureAssetKind()
  ]
});
```

`asset.voxel-map` ships two kinds: `tileset` holds a texture with its tile
size, blocks and material groups, and `voxelmap` holds the layers of a world
and its links to tilesets, which it lists as dependencies. Both packages take
`@jolly-pixel/asset-server` as an optional peer dependency, so a browser-only
consumer of either renderer never installs it.

## Writing an editable kind

A kind with live editing has two halves that must not overlap:
`commands.apply` is the only writer of state, and `commands.live` describes a
room that appends without writing. `AssetRoomExtension` hosts the room, so a
kind supplies only what is specific to it:

```ts
interface AssetLiveProtocol<TCommand = unknown> {
  readonly snapshotSchema: JSONSchema;

  snapshot(): unknown;
  arbitrate(
    command: TCommand
  ): AssetArbitration<TCommand> | null;
  broadcast?(command: TCommand): AssetRoomMessage;
}
```

`commands.protocol` is a JSON Schema `MessageProtocol` that serves the room
and replay alike, so a command is accepted by the same rule on its way into
the log and on its way back out. The schema is compiled once per protocol.

`live` runs once per room, so per-room state such as a conflict tracker
belongs in the returned protocol rather than in the handler:

```ts
commands: {
  eventType: MY_COMMAND,
  protocol: myCommandProtocol,
  apply: (state, command) => state.applyCommand(command),

  live({ state }) {
    const arbiter = new MyArbiter({ conflictResolver });

    return {
      snapshotSchema: mySnapshotSchema,
      snapshot: () => state.toJSON(),
      arbitrate: (command) => arbiter.admit(command)
    };
  }
}
```

The room sets `clientId` on the payload to the sender's server-side id,
validates it against `commands.protocol`, arbitrates it,
appends `arbitration.command` under `commands.eventType`, then calls
`arbitration.commit` and broadcasts. `commit` runs only after the append
lands, so a conflict tracker never records a command the store refused. The
append folds through `commands.apply` before it resolves, so state is current
by the time peers hear about the change.

`broadcast` overrides the default `{ type: "command", data: command }`
envelope. `voxel-map` uses it to answer a `world-replace` with a full
snapshot.

The room derives its `protocols` from both schemas: `commands.protocol` is
inbound, and outbound is `serverMessageProtocol({ command, snapshot })` plus
the `deleted` and `rejected` notices. A configured rights table checks each
message under `${kind}.${action}`; a payload naming no declared action is
checked under `${kind}.invalid`.

A room that also mutated the state would apply every command twice: once
itself and once through the fold. Absolute writes survive that, but a command
carrying a delta does not. `voxel-map`'s `position-updated` is exactly such a
command, which is why both shipped kinds keep the halves separate.
