# Command synchronization

Use `DocumentSyncClient` with an existing command document. The document provides
local edits and rollback images; the server extension owns authoritative state.

## Client wiring

Given a typed `room` and `document` whose absolute writes target `command.key`:

```ts
import { DocumentSyncClient } from "@jolly-pixel/network/client";

const sync = new DocumentSyncClient(room, {
  document,
  keys: (command) => [command.key]
});
room.join();
await sync.whenReady();
```

Local document changes send automatically. Return `null` from `keys` for commands
that are not absolute writes. See history's [CommandDocument](../../../history/docs/CommandDocument.md).

## Server responsibilities

Implement these in the room's [Extension](../server/Extension.md):

1. Declare command and sync [protocols](../protocol/Messages.md).
2. Send feature snapshots on join and resync. Room `sync` only confirms membership.
3. Attribute commands to their connection, apply accepted edits, and broadcast
   outcomes, including to the sender.
4. Repair refused edits with a snapshot or correction. Include processed sequences
   in `acks` and the refused local sequence in `refused`.

The feature supplies versions and recovery state. Client and server share conflict
policy. Validate resume data, then return catch-up or a snapshot.

## Cleanup

Call `sync.destroy()` and `room.leave()`. Handle `overflow` and `discarded` when
reporting lost offline edits. See [CommandSync](../client/CommandSync.md).
