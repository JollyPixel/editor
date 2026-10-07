# CommandDocument

Base class of a document edited by commands. It applies each command to a `CommandState` and emits a [`CommandChange`](./CommandChange.md) that a [`CommandHistory`](./CommandHistory.md) records and a sync client sends. `@jolly-pixel/network`'s `DocumentSyncClient` syncs a `CommandDocument` over a room.

```ts
interface SetCommand {
  key: string;
  value: number;
}

interface SetImage {
  key: string;
  value: number | undefined;
}

class Stats extends CommandDocument<SetCommand, Record<string, number>, SetImage> {
  constructor(values: Map<string, number>) {
    super({
      accepts: ({ value }) => value >= 0,
      placeable: (command) => command,
      apply: ({ key, value }) => values.set(key, value),
      load: (snapshot) => {
        values.clear();
        for (const [key, value] of Object.entries(snapshot)) {
          values.set(key, value);
        }
      },
      imageOf: ({ key }) => ({ key, value: values.get(key) }),
      inverseOf: ({ key }) => [{ key, value: values.get(key) ?? 0 }],
      restored: (images) => {
        const snapshot = Object.fromEntries(values);
        for (const { key, value } of images.toReversed()) {
          if (value === undefined) {
            delete snapshot[key];
          }
          else {
            snapshot[key] = value;
          }
        }

        return snapshot;
      }
    });
  }

  set(key: string, value: number): boolean {
    return this.commit({ key, value });
  }
}

const stats = new Stats(new Map());
stats.subscribe("change", (change) => console.log(change.origin, change.inverse));
stats.set("hp", 20); // true, emits a local change
stats.set("hp", -1); // false, refused by accepts(), nothing emitted
```

## Constructor

```ts
new CommandDocument<TCommand, TSnapshot, TImage>(
  state: CommandState<TCommand, TSnapshot, TImage>
)
```

## CommandState

The state owns the data; the document only calls it.

### accepts(command): boolean

Whether the command applies to the state now. A refused command changes nothing and emits nothing.

### placeable(command): TCommand

The command adjusted to where it still fits. Only `applyStep` uses it, for an undo or redo.

### apply(command): void

Applies the command.

### load(snapshot): void

Replaces the state.

### imageOf(command): TImage

What the command is about to replace. Read before `apply`.

### inverseOf(command): TCommand[]

The commands undoing it. Read before `apply`, for local changes only.

### restored(images): TSnapshot

The snapshot with `images` put back. `images` are ordered oldest first. Only `revert` uses it.

## Properties

### receipts

The [`ChangeReceipts`](./ChangeReceipts.md) carrying the server's answers about this document's local changes.

## Methods

Every method that applies a command returns `false` or `null` when `accepts()` refuses it.

### commit(command): boolean

Protected. Applies a local edit (`origin: "local"`). Subclass edit methods call it.

### applyStep(command, basis): CommandChange | null

Applies `placeable(command)` as a local edit with `basis` set. `CommandHistory` calls it on undo and redo.

### apply(command, clientId = null): boolean

Applies a peer command (`origin: "remote"`).

### replayPending(command): CommandChange | null

Re-applies one of this client's pending commands after a peer's (`origin: "replay"`).

### revert(images): void

Loads `restored(images)` and emits `reset` with `"rewind"`. Does nothing when `images` is empty.

### load(snapshot): void

Replaces the state and emits `reset` with `"load"`.

## Events

### change

```ts
(change: CommandChange<TCommand, TImage>) => void
```

Emitted after each applied command.

### reset

```ts
(cause: "load" | "rewind") => void
```

Emitted after `load` or `revert` replaced the state. See [origins](./guides/collaborative-undo.md#origins) for how the history treats each cause.
