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
readonly overflowed: boolean;
```

`ready` reports first-snapshot readiness; `version` is the applied server position.
`pending` counts outstanding edits; `overflowed` reports offline buffer overflow.

## Methods

### `send(body, timestamp?, basis?): TCommand`

Stamps an already-applied edit. `basis` is the version replayed by undo/redo.

### `destroy(): void`

Detaches sync and clears pending work. Leave the room separately.

## Document adapters

### DocumentSyncClient

`new DocumentSyncClient(room, { document, keys, resolver? })` sends local changes
and handles rollback/replay through the document's change images.

### SyncedCommandDocument

`new SyncedCommandDocument(room, { document, keys })` groups document and sync.
Its `ready` promise resolves after the first snapshot; `dispose()` detaches sync.

## Outcomes

Own echoes acknowledge edits; peer commands pass through reconciliation.
`acknowledged`, `refused`, and `settled` report outcomes.

### Resume

Reconnects request catch-up or a snapshot using the previous id and version.
Offline buffering is bounded; `overflow` and `discarded` report lost pending work.

## Reconciliation and conflicts

`CommandReconciler` supplies `keys`, `narrow`, `revert`, and `replay`.
Failed rollback requests a snapshot. Client and server must share conflict policy.

### Conflict resolution

`LastWriteWinsResolver` resolves writes and protects newer peer edits from replay.
`ConflictTracker` admissions must be committed after edits succeed.

Use `attributeCommand` to replace claimed client identity before arbitration.
