# CommandSync

Sends stamped commands over a `Room` and emits what the server sends back, without the client's own echoes of commands its state already holds.

```ts
type CommandBody<TCommand extends NetworkCommandHeader> =
  Omit<TCommand, keyof NetworkCommandHeader>;

class CommandSync<
  TCommand extends NetworkCommandHeader,
  TSnapshot,
  TNotice extends NetworkServerNoticeOf<TNotice> = never
> extends Emitter<{
  ready: () => void;
  snapshot: (snapshot: TSnapshot) => void;
  command: (command: TCommand) => void;
  notice: (notice: TNotice) => void;
}> {
  constructor(room: Room<TCommand, NetworkServerMessage<TCommand, TSnapshot, TNotice>>);

  readonly room: Room<TCommand, NetworkServerMessage<TCommand, TSnapshot, TNotice>>;
  readonly ready: boolean;

  whenReady(): Promise<void>;
  send(body: CommandBody<TCommand>, timestamp?: number): void;
  destroy(): void;
}
```

`CommandBody` distributes over a command union.

## Messages

```ts
type NetworkServerMessage<TCommand, TSnapshot, TNotice extends NetworkServerNoticeOf<TNotice> = never> =
  | { type: "snapshot"; data: TSnapshot; }
  | { type: "command"; data: TCommand; }
  | { type: "correction"; data: TCommand; }
  | TNotice;
```

A notice's `type` must be a literal other than `"snapshot"`, `"command"` and `"correction"`. `NetworkServerNoticeOf<TNotice>` resolves to `never` for a notice whose `type` could collide with one, such as `{ type: string }`, so the constraint fails at compile time.

- `snapshot` emits `"snapshot"`, then `"ready"` once, the first time. `whenReady()` returns one promise that resolves at that moment.
- `command` emits `"command"` unless its `clientId` is `room.clientId` and it was sent after the last snapshot. A snapshot replaces local state, so own commands sent before it (held ones included) and echoed after it are emitted like peer commands; they are the ones the snapshot does not contain yet.
- `correction` emits `"command"`, even though it carries the client's own `clientId`. A server sends one in place of a snapshot to undo only what it refused of this client's command. Like a snapshot, it puts the client's later commands back in the replay range, so their echoes are applied on top of the correction.
- Any other `type` emits `"notice"` with the whole message, for server notices such as the asset room's `rejected` and `deleted`.

## Usage

Wire the target's local hook to `send`, and apply what arrives. Subscribe in the same tick as the constructor, so no snapshot is missed.

```ts
class CounterSync extends CommandSync<CounterCommand, CounterSnapshot> {
  constructor(room: Room<CounterCommand, CounterMessage>, counter: Counter) {
    super(room);
    counter.onChange = (event) => this.send(event);
    this.on("snapshot", (snapshot) => counter.load(snapshot));
    this.on("command", (command) => counter.apply(command));
  }
}
```

- `send(body, timestamp?)` builds `{ ...body, clientId: room.clientId, seq, timestamp }`, where `seq` increments per instance and `timestamp` defaults to `Date.now()`. Pass `timestamp` when the original event time must survive, as in replay flows. While `room.clientId` is `null`, bodies are held and sent on the room's next `sync`.
- `destroy()` removes the room listeners and discards held bodies. It does not call `room.leave()`.
