# CommandSync

Sends stamped commands over a `Room`, keeps them in a pending ledger until the server acknowledges them, and emits what the server sends back so the local state converges to the server's.

```ts
type CommandBody<TCommand extends NetworkCommandHeader> =
  Omit<TCommand, keyof NetworkCommandHeader>;

interface CommandSyncOptions<TCommand extends NetworkCommandHeader, TSnapshot = unknown> {
  reconciler?: CommandReconciler<TCommand>;
  resolver?: ConflictResolver<TCommand>;
  applySnapshot?: (snapshot: TSnapshot) => void | Promise<void>;
}

class CommandSync<
  TCommand extends NetworkCommandHeader,
  TSnapshot,
  TNotice extends NetworkServerNoticeOf<TNotice> = never
> extends Emitter<{
  ready: () => void;
  snapshot: (snapshot: TSnapshot) => void;
  "snapshot-failed": (error: unknown) => void;
  command: (command: TCommand) => void;
  notice: (notice: TNotice) => void;
  settled: () => void;
  overflow: () => void;
  acknowledged: (command: TCommand, version: number | undefined) => void;
}> {
  constructor(
    room: Room<TCommand, NetworkServerMessage<TCommand, TSnapshot, TNotice>>,
    options?: CommandSyncOptions<TCommand, TSnapshot>
  );

  readonly room: Room<TCommand, NetworkServerMessage<TCommand, TSnapshot, TNotice>>;
  readonly ready: boolean;
  readonly pending: number;
  readonly version: number;
  readonly overflowed: boolean;

  whenReady(): Promise<void>;
  send(body: CommandBody<TCommand>, timestamp?: number, basis?: number): TCommand;
  destroy(): void;
}
```

`CommandBody` distributes over a command union. `resolver` defaults to `LastWriteWinsResolver`; pass the one the server's arbiter uses.

## Messages

```ts
type NetworkAcks = Record<string, number>;

type NetworkServerMessage<TCommand, TSnapshot, TNotice extends NetworkServerNoticeOf<TNotice> = never> =
  | { type: "snapshot"; data: TSnapshot; version?: number; acks?: NetworkAcks; }
  | { type: "command"; data: TCommand; version?: number; }
  | { type: "correction"; data: TCommand; acks?: NetworkAcks; }
  | { type: "catch-up"; data: TCommand[]; version: number; acks?: NetworkAcks; }
  | TNotice;
```

A notice's `type` must be a literal other than `"snapshot"`, `"command"`, `"correction"` and `"catch-up"`. `NetworkServerNoticeOf<TNotice>` resolves to `never` for a notice whose `type` could collide with one, such as `{ type: string }`, so the constraint fails at compile time.

`acks` maps a client id to the last `seq` the server processed for it, admitted or not. `version` is the [room version](../../GLOSSARY.md#room-version) the message leaves the state at; `version` reads the highest one applied. `serverMessageProtocol` declares both, and the `catch-up` variant.

- `snapshot` acknowledges `acks[room.clientId]`, emits `"snapshot"`, then replays every pending command still in the ledger. It emits `"ready"` once, the first time. `whenReady()` returns one promise that resolves at that moment.
- `command` from the client itself acknowledges its `seq` and every lower one, and is not emitted: the pending replay already put it in the local state. A command from a peer is reconciled with the ledger, then emitted.
- `correction` acknowledges its `acks` and its own `seq`, then is reconciled and emitted like a peer command. A server sends one in place of a snapshot to undo what it refused of this client's command.
- `catch-up` answers a resume; see [Resume](#resume).
- Any other `type` emits `"notice"` with the whole message, for server notices such as the asset room's `rejected` and `deleted`.

`applySnapshot` loads a snapshot before `"snapshot"` is emitted. When it returns a promise, as an asynchronous decode does, every later message is held and processed in order once the promise settles. A rejection emits `"snapshot-failed"` instead of `"snapshot"`, leaves `ready` unchanged, and releases the held messages.

`"settled"` fires when an acknowledgement empties the ledger. `"acknowledged"` fires for each own echo with the pending command it acknowledges and the echo's `version`.

## Pending ledger

`send(body, timestamp?)` stamps `{ ...body, clientId: room.clientId, seq, timestamp }`, where `seq` increments per instance and `timestamp` defaults to `Date.now()`. Pass `timestamp` when the original event time must survive, as in undo flows, and `basis` for a command that replays an earlier one: the room version of the original, learned from `"acknowledged"`. See [Conflicts](./Conflicts.md#lastwritewinsresolver). While `room.clientId` is `null`, the command is held and sent on the room's next `sync`.

`send` returns the pending command. The object stays the same while it is pending, so a reconciler can key the inverse it captured on it. The room receives a copy.

The server processes one client's commands in order, so every acknowledgement is cumulative.

## Reconciliation

Without a reconciler, a peer command is emitted as is, and a correction or snapshot is followed by the pending commands, emitted as `"command"`. That is only safe when every command writes absolute values.

With a reconciler, the local state follows one rule: server state, then pending commands in `seq` order.

```ts
interface CommandReconciler<TCommand extends NetworkCommandHeader> {
  keys(command: TCommand): readonly string[] | null;
  narrow(command: TCommand, keep: readonly number[]): TCommand | null;
  revert(pending: readonly TCommand[]): boolean;
  replay(command: TCommand): boolean;
}
```

| Member | Contract |
|---|---|
| `keys` | The registers an absolute write sets, one key per entry; `null` for any other command. |
| `narrow` | The command restricted to the entries at `keep`, or `null` when it cannot be restricted. |
| `revert` | Undoes the pending commands, last first, from inverses captured when each was applied. Returns `false`, and changes nothing, when one has no inverse. |
| `replay` | Applies a pending command locally without sending it and without adding it to undo history, and captures its inverse. Returns `false` when the local state rejects it. |

A peer command or correction takes one of two paths:

- **Keyed.** When it has keys and every pending command has keys, the entries a pending write outlives are dropped: the resolver accepts the pending write over the incoming one, carrying the message's `version`, so the server will too. The rest is emitted through `narrow`. When `narrow` returns `null`, the whole command is emitted and the outliving pending writes are replayed on top.
- **Rebase.** Otherwise the pending commands are reverted, the command is emitted, and every pending command is replayed. A pending command whose replay fails leaves the local state and stays in the ledger until its acknowledgement; the server will reject it and repair the client. If the server admits it after all, its echo is applied.

When `revert` returns `false`, `CommandSync` calls `room.resync()`, ignores peer commands and corrections until the snapshot arrives, then loads it and replays the ledger.

## Usage

Wire the target's local hook to `send`, capture an inverse for what `send` returns, and apply what arrives. Subscribe in the same tick as the constructor, so no snapshot is missed.

```ts
class CounterSync extends CommandSync<CounterCommand, CounterSnapshot> {
  constructor(room: Room<CounterCommand, CounterMessage>, counter: Counter) {
    const inverses = new WeakMap<CounterCommand, number>();
    super(room, {
      reconciler: {
        keys: () => ["value"],
        narrow: () => null,
        revert: (pending) => {
          const values = pending.map((command) => inverses.get(command));
          if (values.includes(undefined)) {
            return false;
          }
          counter.set(values[0]!);

          return true;
        },
        replay: (command) => {
          inverses.set(command, counter.value);
          counter.set(command.value);

          return true;
        }
      }
    });
    counter.onChange = (event) => inverses.set(this.send(event), event.previous);
    this.on("snapshot", (snapshot) => counter.load(snapshot));
    this.on("command", (command) => counter.set(command.value));
  }
}
```

## Resume

`CommandSync` installs `room.resumeWith()`. After a reconnect, the room's `join` carries `{ clientId, version }`: the previous client id and `version`. It omits `version` while a resync is pending, to ask for a snapshot.

When the new `sync` names another client id, `CommandSync` holds new commands, ignores peer commands, and treats the previous id's echoes as acknowledgements until one of these arrives:

- `{ type: "catch-up", data, version, acks }`: the commands after the resumed version, in order. Commands from the previous id acknowledge the ledger; the others are reconciled like peer commands.
- A snapshot, when the server has no catch-up for that version.

Then every command still pending, sent before the drop or held since, is stamped with the new client id and a new `seq` and sent. A command the server processed before the drop is acknowledged by `acks[previousClientId]` or by its echo in the catch-up, so it is not sent twice.

While the room has no client id, the ledger holds at most 500 commands or 2 MB of bodies. Past either, `overflowed` becomes `true`, `"overflow"` fires, and new commands are applied locally only. The next join then sends no resume, the ledger is dropped, and the snapshot replaces the unsaved local changes.

`destroy()` removes the room listeners and the resume source, and discards the ledger. It does not call `room.leave()`.
