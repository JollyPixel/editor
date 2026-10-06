# Asset kinds

An `AssetKindHandler` defines how one asset type is recognized, folded into
state and serialized.

```ts
type AssetCommandHeader = Partial<NetworkCommandHeader>;

interface AssetKindHandler<
  TState = unknown,
  TCommand extends AssetCommandHeader = AssetCommandHeader
> {
  readonly kind: string;
  readonly extensions: Readonly<Record<string, string>>;
  readonly match?: readonly string[];
  readonly snapshot?: SnapshotPolicy;
  readonly commands?: AssetCommands<TState, TCommand>;
  readonly companions?: readonly AssetKindCompanion<TState>[];

  create(assetId: string): TState;
  load(state: TState, content: Uint8Array): void;
  clear(state: TState): void;
  serialize(state: TState): Promise<Uint8Array>;
  dependencies?(state: TState): readonly AssetReferenceData[];
  rebind?(state: TState, idMap: ReadonlyMap<string, string>): void;
}

interface AssetCommands<
  TState = unknown,
  TCommand extends AssetCommandHeader = AssetCommandHeader
> {
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

A command may carry the `network` command header (`clientId`, `seq`,
`timestamp`), which is why `TCommand` extends `AssetCommandHeader`. The
room stamps `clientId` and acknowledges `seq`; a command type without the
header extends `AssetCommandHeader` and leaves its fields out.

`serialize` returns the bytes stored by the asset source. A kind that supports
live editing provides `commands.live`; other kinds have no dynamic editing
room.

`dependencies` lists the assets a state references, such as the blocksets of
a voxel map. The writer records them on every `asset.created` and
`asset.updated` event, so it runs on every lifecycle write. A kind that
references nothing omits it. See [dependency edges](./Catalog.md#dependency-edges).

`rebind` changes references to IDs present in `idMap` when importing an
archive as a copy. The handler mutates the loaded state before serialization.
Kinds with no references can omit it.

### Companions

```ts
interface AssetKindCompanion<TState = unknown> {
  readonly kind: string;

  link(state: TState, companion: AssetReferenceData): void;
}
```

`companions` lists the assets an asset of this kind needs from the start, such
as the blockset of a voxel map. They are only created when the asset itself is
[created without content](./AssetWriter.md#create): the writer creates one
asset of each companion kind, in its default state, beside the new asset, then
calls `link` on the new asset's fresh state with the companion's reference
before serializing it. `dependencies` should report the linked reference so
the pair gets its dependency edge. A companion's own companions are not
created. Each companion kind must be registered and claim an extension that
differs from the owner's and from the other companions'.

Import the handler contract from `@jolly-pixel/asset-server`. It exposes
the handler and live protocol types, `foldAssetEvent`, the built-in handlers
and the asset event helpers:

```ts
import {
  foldAssetEvent,
  type AssetKindHandler
} from "@jolly-pixel/asset-server";
```

## Folding

Handlers never read raw events. `foldAssetEvent` parses each event and calls
the matching hook:

```ts
function foldAssetEvent<TState, TCommand extends AssetCommandHeader>(
  handler: AssetKindHandler<TState, TCommand>,
  state: TState,
  event: Event
): TCommand | null;
```

It returns the command it applied, or `null` for any other event.

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
import { InvalidAssetDocumentError } from "@jolly-pixel/asset-server";

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

```ts
kinds.decode(
  kind: string,
  assetId: string,
  content: Uint8Array
): Result<DecodedAsset, Error>

interface DecodedAsset {
  readonly handler: AssetKindHandler;
  readonly state: unknown;
}
```

`decode` loads `content` into a fresh state of `kind`. An unregistered kind
is returned as `UnknownAssetKindError` and a `create` or `load` that throws as
the thrown error. Dependency computation, archive checks and archive copies
all go through it.

## Descriptor

```ts
interface AssetKindDescriptor {
  kind: string;
  label: string;
  extension: string;
  icon?: AssetKindIcon;
}

interface AssetKindIcon {
  svg: string;
  tone?: string;
  viewBox?: string;
}
```

A descriptor is the kind's presentation as plain data: a label, the
extension a new asset of the kind gets (leading dot included, one of the
handler's `extensions`), and an icon whose `svg` holds the children of its
`viewBox` (`"0 0 24 24"` when omitted). A full-colour icon keeps its literal
colours and leaves `tone` out. A host that lists, opens or creates assets reads it without loading
the handler, so a descriptor can also come from a manifest. Packages export one beside their handler
(`PIXEL_ART_ASSET`, `VOXEL_MAP_ASSET`, `VOXEL_MODEL_ASSET`).

## Built-in kinds

`binary` is the reserved fallback. `texture` is a shipped handler that claims
image files so a runtime `AssetType` of the same name can resolve them:

```ts
import { textureAssetKind } from "@jolly-pixel/asset-server";

const kinds = new AssetKindRegistry([textureAssetKind()]);
```

`builtInAssetKinds()` returns the shipped handlers a project gets on top of
its kind packages, today `[textureAssetKind()]`; see
[Project](./Project.md). The registry itself registers none of them, so
`.png` stays `binary` unless a host adds `texture`.

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
`BLOCKSET_EXTENSION`, `VOXEL_MAP_EXTENSION`, `VOXEL_MODEL_EXTENSION`), so the
editors that create
documents and the server agree on it:

```ts
import { pixelArtAssetKind } from "@jolly-pixel/asset.pixel-art";
import {
  blocksetAssetKind,
  voxelMapAssetKind
} from "@jolly-pixel/asset.voxel-map";

await createAssetBackend({
  source,
  eventStore,
  handlers: [
    pixelArtAssetKind(),
    blocksetAssetKind(),
    voxelMapAssetKind(),
    textureAssetKind()
  ]
});
```

`asset.voxel-map` ships two kinds: `blockset` holds a texture with its tile
size, blocks and material groups, and `voxelmap` holds the layers of a world
and its links to blocksets, which it lists as dependencies. Both packages take
`@jolly-pixel/asset-server` as an optional peer dependency, so a browser-only
consumer of either renderer never installs it.

## Kind packages

A package that ships kinds also exports them as one `ASSET_KINDS` value, so a
host can load them by package name from a [project file](./Project.md):

```ts
interface AssetKindPackage<TOptions extends object = object> {
  readonly descriptors: readonly AssetKindDescriptor[];
  readonly optionsSchema: JSONSchema;

  handlers(options?: TOptions): AssetKindHandler[];
}
```

`handlers` builds a fresh handler for each kind the package ships, from the
options the project gives it. Each descriptor names one of those kinds.
`optionsSchema` describes the JSON options a project file may pass, so a typo
fails when the project loads rather than inside a handler. Options that are
not JSON, such as `conflictResolver`, stay out of it. `SNAPSHOT_POLICY_SCHEMA`
describes a `SnapshotPolicy` for packages to nest in their schema.

```ts
import { ASSET_KINDS } from "@jolly-pixel/asset.voxel-map";

const handlers = ASSET_KINDS.handlers({
  blockset: { tileSize: 16 },
  voxelmap: { chunkSize: 16 }
});
```

`asset.pixel-art` takes `{ defaultSize?, snapshot? }` and `asset.voxel-model`
takes `{ snapshot? }`. `asset.voxel-map` takes `{ blockset?, voxelmap? }`, one
entry per kind: `{ tileSize?, defaultSize?, snapshot? }` and
`{ chunkSize?, snapshot? }`.

## Writing an editable kind

A kind with live editing has two halves that must not overlap:
`commands.apply` is the only writer of state, and `commands.live` describes a
room that appends without writing. `AssetRoomExtension` hosts the room, so a
kind supplies only what is specific to it:

```ts
type AssetBroadcast<TCommand> =
  | { readonly type: "command"; readonly data: TCommand }
  | { readonly type: "snapshot"; readonly data: unknown };

interface AssetLiveProtocol<
  TCommand extends AssetCommandHeader = AssetCommandHeader
> {
  readonly snapshotSchema: JSONSchema;

  snapshot(): unknown;
  encodeSnapshot?(): Promise<unknown>;
  arbitrate(
    command: TCommand
  ): AssetArbitration<TCommand> | null;
  broadcast?(command: TCommand): AssetBroadcast<TCommand>;
  correct?(
    command: TCommand,
    admitted: TCommand | null
  ): TCommand | null;
  restore?(command: TCommand, version: number): void;
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

The network server validates the payload against `commands.protocol`, then
the room sets `clientId` to the sender's server-side id, arbitrates it,
appends `arbitration.command` under `commands.eventType`, then calls
`arbitration.commit(eventVersion)` and broadcasts. `commit` runs only after the append
lands, so a conflict tracker never records a command the store refused. The
append folds through `commands.apply` before it resolves, so state is current
by the time peers hear about the change.

An arbitration that returns `null` or a narrowed command also resyncs the
author; return the received command itself when it is admitted whole. The
room first asks `correct` for a command that restores, on the author's side,
what `command` touched but `admitted` (`null` when nothing was kept) did not.
It sends that command as `{ type: "correction", data, acks }`. Without
`correct`, or when it returns `null`, the author gets `{ type: "snapshot",
data, acks }`. Build the correction from current state and write absolute
values: the author replays its later commands on top of it. `broadcast`
overrides the default `{ type: "command", data: command }` envelope.
`voxel-map` uses it to answer a `world-replace` with a full snapshot.

`encodeSnapshot` returns a smaller form of `snapshot()` that also matches
`snapshotSchema`, such as PNG pixels. It must read the state before its first
`await`. A join waits for it and the room keeps the result for that room
version, so later joins and resyncs at the same version reuse it. When the
version moved during the encode, or the encode rejects, the room sends
`snapshot()` instead.

The room hands `restore` every command since the asset's last checkpoint, in
order and with its version, so a conflict tracker knows which writes a later
undo must not overwrite. `registerAssetRooms` passes the commands the state
store recorded while folding them, so opening a room reads the log once.

The room keeps the last `seq` it processed per member, admitted or not, and
sends it as `acks` so the client's [`CommandSync`](../../network/docs/sync/CommandSync.md)
can drop acknowledged commands from its pending ledger: `{ [author]: seq }`
on a correction or resync snapshot, every member's entry on a snapshot that
`broadcast` returns. A `Room.resync()` request gets a snapshot with the
member's `acks`.

Every command broadcast carries `version`, the `eventVersion` of its event,
and every snapshot the [room version](../../network/GLOSSARY.md#room-version)
it reflects. A join whose `resume` names a previous client id and a version
waits until that client has left the room (at most `departureTimeout`), then
gets `{ type: "catch-up", data, version, acks }`: the command events after
that version, read from the event store, and the previous client's last
processed `seq`. Renames and scheduled snapshots in the range are skipped.
The room sends a snapshot with the same `acks` instead when the resume has no
version, a plain snapshot when the resume is malformed, the range holds more than `resumeLimit` events or any other event,
or compaction removed its start.

```ts
interface AssetRoomExtensionOptions<TCommand = unknown> {
  reader?: EventStore.EventReader; // without it, a resume gets a snapshot
  restore?: Iterable<RecordedCommand<TCommand>>;
  resumeLimit?: number; // default 1_000
  departureTimeout?: number; // default 5_000 ms
}
```

`registerAssetRooms` passes the store's reader and the room version the
state store folded to. At 1,000 events a pixel-art catch-up of 40-pixel
strokes is about the size of a 256 by 256 snapshot (350 KB uncompressed).

The room derives its `protocols` from both schemas: `commands.protocol` is
inbound, and outbound is `serverMessageProtocol({ command, snapshot, notices })`
with the `deleted` and `rejected` notices. A configured rights table checks each
message under `${kind}.${action}`; a payload naming no declared action is
checked under `${kind}.invalid`.

A room that also mutated the state would apply every command twice: once
itself and once through the fold. Absolute writes survive that, but a command
carrying a delta does not. `voxel-map`'s `position-updated` is exactly such a
command, which is why both shipped kinds keep the halves separate.
