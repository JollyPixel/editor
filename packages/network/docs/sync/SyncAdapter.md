# SyncAdapter

Base class for client-side sync of one local target over one `Room`.
It centralizes shared logic: local command stamping, echo-guarding, snapshot handling, and ready state.
Domain implementations only define how to read/write the target mutation hook and apply snapshots/remote commands.

```ts
interface NetworkCommandHeader {
  clientId: string;
  seq: number;
  timestamp: number;
}

type NetworkServerMessage<Command, Snapshot> =
  | { type: "snapshot"; data: Snapshot; }
  | { type: "command"; data: Command; };

abstract class SyncAdapter<
  Target,
  Event extends object,
  Command extends NetworkCommandHeader,
  Snapshot
>
  extends Emitter<{ ready: () => void }> {
  constructor(
    room: Room<Command, NetworkServerMessage<Command, Snapshot>>
  );

  readonly ready: boolean;

  attach(target: Target): void;
  detach(): void;
  destroy(): void;

  protected stampCommand(event: Event, timestamp?: number): Command;
  protected abstract getHandler(target: Target): ((event: Event) => void) | undefined;
  protected abstract setHandler(target: Target, fn: ((event: Event) => void) | undefined): void;
  protected abstract applySnapshot(target: Target, snapshot: Snapshot): void;
  protected abstract applyRemoteCommand(target: Target, cmd: Command): void;
}
```

## Usage

Implement the four abstract hooks; `attach`, `detach`, `destroy`, stamping, and echo-guarding are inherited:

```ts
class PixelSyncClient extends SyncAdapter<PixelArtCanvas, PixelBufferHookEvent, PixelNetworkCommand, PixelBufferSnapshot> {
  protected getHandler(canvas) { return canvas.onBufferUpdated; }
  protected setHandler(canvas, fn) { canvas.onBufferUpdated = fn; }
  protected applySnapshot(canvas, snapshot) { canvas.loadSnapshot(/* ... */); }
  protected applyRemoteCommand(canvas, cmd) { canvas.applyRemoteCommand(cmd); }
}
```

## Properties

### `ready`

```ts
readonly ready: boolean
```

Whether the initial server snapshot has been applied. Emits `"ready"` once when this becomes `true`.

## Methods

### `attach`

```ts
attach(target: Target): void
```

Reads the current local handler via `getHandler`, then installs a wrapper via `setHandler`.
The wrapper calls the previous handler and forwards a stamped command to the room.
Throws if a target is already attached.

### `detach`

```ts
detach(): void
```

Restores the handler captured during `attach()`. No-op when no target is attached.

### `destroy`

```ts
destroy(): void
```

Calls `detach()` and removes the `"message"` listener it registered on the room.
Does **not** call `room.leave()`. Override if the client owns room lifetime.

## Protected hooks

### `stampCommand`

```ts
protected stampCommand(event: Event, timestamp?: number): Command
```

Builds `{ ...event, clientId, seq, timestamp }`.
Uses an internal counter for `seq` and `Date.now()` for `timestamp` unless a timestamp is passed.
Override when event time should be preserved (for example, replay flows).

### `getHandler` / `setHandler`

Abstract accessors for the target local-mutation hook (for example, `onBufferUpdated`).

### `applySnapshot` / `applyRemoteCommand`

Abstract sinks for the initial `"snapshot"` message and later `"command"` messages.
Commands from the same `clientId` are filtered before `applyRemoteCommand`.
