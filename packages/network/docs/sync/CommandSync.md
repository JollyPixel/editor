# CommandSync

Sends stamped commands over a `Room` and emits what the server sends back, without the client's own echoes.

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
  | TNotice;
```

A notice's `type` must be a literal other than `"snapshot"` and `"command"`. `NetworkServerNoticeOf<TNotice>` resolves to `never` for a notice whose `type` could collide with one, such as `{ type: string }`, so the constraint fails at compile time.

- `snapshot` emits `"snapshot"`, then `"ready"` once, the first time.
- `command` emits `"command"` unless its `clientId` is `room.clientId`.
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
