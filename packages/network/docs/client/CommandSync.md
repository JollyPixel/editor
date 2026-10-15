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

`new CommandSync(room, options?)` subscribes to messages and installs resume data.
Construct before joining. `whenReady()` resolves after the first snapshot.

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

## Document adapters

### DocumentSyncClient

`new DocumentSyncClient(room, { document, keys, resolver? })` sends local changes
and handles rollback/replay through the document's change images.

### SyncedCommandDocument

`new SyncedCommandDocument(room, { document, keys })` groups document and sync.
Its `ready` promise resolves after the first snapshot; `dispose()` detaches sync.
`pendingChanges` exposes the sync as `PendingChanges`: `pending`, `keepIn()`,
plus `on` and `off` for the `settled` and `unsettled` events.

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
Failed rollback requests a snapshot. Client and server must share conflict policy.

### Conflict resolution

`LastWriteWinsResolver` resolves writes and protects newer peer edits from replay.
`ConflictTracker` admissions must be committed after edits succeed.

Use `attributeCommand` to replace claimed client identity before arbitration.
