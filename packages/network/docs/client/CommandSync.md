# CommandSync

`CommandSync`
reconciles optimistic edits with server snapshots and command outcomes.
See the [usage guide](../guides/command-sync.md) for document wiring.

```ts
import { DocumentSyncClient } from "@jolly-pixel/network/client";

const sync = new DocumentSyncClient(room, {
  document,
  keys: (command) => [command.key]
});
```

Here the typed room and document share command and snapshot types.

## Constructor and readiness

`new CommandSync(room, { reconciler, applySnapshot?, receipts? })` subscribes to
messages and installs resume data. Construct before joining. `whenReady()`
resolves after the first snapshot.

## Properties

```ts
readonly ready: boolean;
readonly pending: number;
readonly version: number;
```

`ready` reports first-snapshot readiness; `version` is the applied server position.
`pending` counts outstanding edits.

## Methods

### `send(body, timestamp?, basis?): TCommand`

Stamps an already-applied edit. `basis` is the version replayed by undo/redo.

### `sendChange(body, change, receipts?): TCommand`

Sends `body` with `change.basis` and answers `change` in `receipts` once the
server acknowledges or refuses it. `receipts` defaults to the `receipts`
option; pass another one when a document syncs two kinds of change through one
client. With neither, the change gets no answer.

### `keepIn(outbox): void`

Mirrors the unacknowledged commands into `outbox`, so they outlive the page.
Call it before joining the room and before any `send()`; otherwise it throws.

```ts
interface ChangeOutbox {
  restore(): readonly NetworkCommandHeader[];
  keep(command: NetworkCommandHeader): void;
  drop(command: NetworkCommandHeader): void;
}
```

- `restore()` returns, oldest first, the commands a previous sync of the same
  room left. They become pending ahead of any new command.
- `keep()` receives a command when it is queued and again each time its header
  is stamped for sending. Store a copy and key it by the object: later calls
  pass the same object.
- `drop()` receives a command once the server answered it or it was discarded.
- `destroy()` leaves the outbox untouched.

When a restored command was already sent, the sync joins with that command's
client id as resume data. The server's acknowledgements for that id skip the
commands it applied before the page closed; the rest replay over the first
snapshot and are sent again.

### `destroy(): void`

Detaches sync and clears pending work. Leave the room separately.

### `protected resync(): void`

Asks the room for a fresh snapshot, once until it lands. Meanwhile peer
commands are skipped and own echoes only acknowledge their edits. A subclass
calls it when its document no longer matches the room.

## Document adapters

### DocumentSyncClient

`new DocumentSyncClient(room, { document, keys, resolveSnapshot? })` sends
local changes and handles rollback/replay through the document's change images.
Every snapshot loads through `applySnapshot`, so the document holds it before
the sync confirms the acknowledgements the snapshot carries.

`resolveSnapshot(received, room)` turns a received snapshot into the value
`document.load()` takes, for a room whose snapshot can arrive in another form,
such as a reference fetched over HTTP. It is a `SnapshotResolver<TSnapshot>`.
A returned promise holds later room messages until it settles, as
`applySnapshot` does; a rejection emits `snapshot-failed`. A plain value loads
in the same turn. To wait for a room message inside the resolver, listen on
`room` directly: the sync holds its own copy of that message until the
promise settles, then handles it as usual.

### SyncedDocument

Abstract base that pairs a document with the sync that keeps it up to date.

```ts
abstract class SyncedDocument<TDocument> {
  abstract readonly document: TDocument;
  readonly ready: Promise<void>;
  readonly loaded: boolean;
  readonly pendingChanges: PendingChanges;

  constructor(sync: DocumentSync);
  dispose(): void;
}
```

`ready` resolves after the first snapshot and `loaded` turns `true` at the same
time. `pendingChanges` exposes the sync as `PendingChanges`: `pending`,
`keepIn()`, plus `on` and `off` for the `settled` and `unsettled` events.
`dispose()` destroys the sync. A `CommandSync` satisfies `DocumentSync`.

### DocumentKind

```ts
interface DocumentKind<TKind extends string, TRoom, TSynced extends SyncedDocument<unknown>> {
  readonly kind: TKind;
  syncDocument(room: TRoom): TSynced;
}
```

Pairs an asset kind with the factory of its synced document. Each
`syncDocument(room)` call returns a new `TSynced` bound to `room`.

### EditableDocumentKind

```ts
interface EditableDocumentKind<TKind extends string, TRoom, TSynced extends SyncedDocument<unknown>, TCommand>
  extends DocumentKind<TKind, TRoom, TSynced> {
  readonly commandSchema: z.ZodMiniType<TCommand>;
  readonly commandProtocol: MessageProtocol;
  localEdits(synced: TSynced): LocalEdits<TCommand>;
}
```

A `DocumentKind` that a client outside an editor can write to with raw
commands. `commandSchema` parses a command without its network header,
`commandProtocol` is the room protocol, whose `events` name the actions the
room can refuse. `localEdits(synced)` returns the `LocalEdits` from
`@jolly-pixel/history` that applies a command to that synced document and
answers it once the server does.

### SyncedCommandDocument

`new SyncedCommandDocument(room, { document, keys, resolveSnapshot? })` is a
`SyncedDocument` over a `DocumentSyncClient`.

`SyncedCommandDocument<TDocument, TNotice>` reads the command, snapshot and
image types from the document's `applyRemote`, `load` and `revert` signatures.
The command type is the type `applyRemote` takes, joined with
`NetworkCommandHeader`; the image type is the element type `revert` takes.

- `CommandSyncableDocument<TDocument>` is the `SyncableDocument` built from
  those three types, the constraint every document must satisfy;
- `SyncedDocumentRoom<TDocument, TNotice>` is the room the document syncs
  through.

`TNotice` defaults to `never`.

### commandDocumentKind

`commandDocumentKind({ kind, createDocument, keys, resolveSnapshot? })` returns `{ kind, syncDocument(room) }`.
Each `syncDocument(room)` call builds a new document with `createDocument()`
and returns it wrapped in a `SyncedCommandDocument` bound to `room`, `keys`
and `resolveSnapshot`.
`CommandDocumentKind<TKind, TDocument, TNotice>` is the `DocumentKind` it
returns, with the room and the synced document derived from the document. Annotate the return type to name the notices the room may send:

```ts
import {
  commandDocumentKind,
  type CommandDocumentKind
} from "@jolly-pixel/network/client";

function counterKind(): CommandDocumentKind<"counter", CounterDocument, CounterNotice> {
  return commandDocumentKind({
    kind: "counter",
    createDocument: () => new CounterDocument(),
    keys: (command) => [command.key]
  });
}
```

## Outcomes

Own echoes acknowledge edits; peer commands pass through reconciliation.
`acknowledged`, `refused`, and `settled` report outcomes.
`unsettled` fires when `pending` leaves zero, and `settled` when it returns to
zero, including after a discard.

### Resume

Reconnects request catch-up or a snapshot using the previous id and version.
Commands sent while disconnected are held without a bound and sent once the
catch-up or snapshot arrives.

A pending command whose replay throws is discarded: the sync emits `refused`
for it and asks for a fresh snapshot.

## Reconciliation and conflicts

`CommandReconciler` supplies `keys`, `narrow`, `revert`, and `replay`.
Failed rollback requests a snapshot.

### Conflict resolution

Client and server settle each key with the same last-write-wins rule: a write
from the same client always wins; against a write that landed at a version, a
fresh write wins and a replay wins only when its `basis` is not older; otherwise
the newer `timestamp` wins, then the greater `clientId`.

The server side applies it with a
[`KeyedCommandArbiter`](../server/Arbitration.md).
