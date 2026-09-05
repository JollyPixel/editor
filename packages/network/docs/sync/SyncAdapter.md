# SyncAdapter

Base class for synchronizing one local target over a room, including command stamping, echo guards, snapshots and ready state. Subclasses provide the target's mutation hook and apply incoming data.

```ts
abstract class SyncAdapter<
  Target,
  Event extends object,
  Command extends NetworkCommandHeader,
  Snapshot
> extends Emitter<{ ready: () => void }> {
  constructor(room: Room<Command, NetworkServerMessage<Command, Snapshot>>);

  readonly ready: boolean;

  attach(target: Target): void;
  detach(): void;
  destroy(): void;

  protected notifyLocal(event: Event): void;
  protected stampCommand(event: Event, timestamp?: number): Command;
  protected abstract getHandler(target: Target): ((event: Event) => void) | undefined;
  protected abstract setHandler(target: Target, fn: ((event: Event) => void) | undefined): void;
  protected abstract applySnapshot(target: Target, snapshot: Snapshot): void;
  protected abstract applyRemoteCommand(target: Target, cmd: Command): void;
}
```

## Usage

Implement the four abstract hooks; everything else is inherited.

```ts
class PixelSyncClient extends SyncAdapter<
  PixelArtCanvas,
  PixelBufferHookEvent,
  PixelNetworkCommand,
  PixelBufferSnapshot
> {
  protected getHandler(canvas) {
    return canvas.onBufferUpdated;
  }
  protected setHandler(canvas, fn) {
    canvas.onBufferUpdated = fn;
  }
  protected applySnapshot(canvas, snapshot) {
    canvas.loadSnapshot(/* ... */);
  }
  protected applyRemoteCommand(canvas, cmd) {
    canvas.applyRemoteCommand(cmd);
  }
}
```

## Lifecycle

- `attach(target)` — captures the current handler via `getHandler`, then installs a wrapper via `setHandler` that calls the original and forwards a stamped command to the room. Throws if a target is already attached.
- `detach()` — restores the captured handler. No-op when nothing is attached.
- `destroy()` — `detach()` plus removal of the room listener. Does **not** call `room.leave()`; override if the client owns the room's lifetime.
- `ready` — whether the initial server snapshot has been applied. Emits `"ready"` once when it flips.

## Hooks

- `getHandler` / `setHandler` — accessors for the target's local mutation hook (e.g. `onBufferUpdated`).
- `applySnapshot` / `applyRemoteCommand` — sinks for the initial snapshot and later commands. Commands from the local `clientId` are filtered out before `applyRemoteCommand`.
- `notifyLocal(event)` — replays an event to the handler captured at `attach`, without sending it back to the room. Call it from `applyRemoteCommand` when the target applies remote changes silently, so local observers still see them.
- `stampCommand(event, timestamp?)` — builds `{ ...event, clientId, seq, timestamp }`, using an internal counter and `Date.now()`. Override when the original event time must survive, as in replay flows.
