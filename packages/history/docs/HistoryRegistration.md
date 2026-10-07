# HistoryRegistration

What [`CommandHistory.register()`](./CommandHistory.md#methods) takes: a document and the keys that guard its steps. See [guards](./guides/collaborative-undo.md#guards).

```ts
history.register({
  id: "stats",
  document: stats,
  keys: {
    written: ({ command }) => [command.key],
    guard: (commands) => new KeyedGuard(commands.map(({ key }) => {
      return { key, read: () => values.get(key) };
    }))
  },
  scopeOf: () => "build"
});
```

```ts
interface HistoryRegistration<TScope, TCommand, TImage, TWritten = Iterable<string>, TCapture = KeyedSnapshot> {
  id: string;
  document: HistorySource<TCommand, TImage>;
  keys: HistoryKeys<TCommand, TImage, TWritten, TCapture>;
  scopeOf(change: CommandChange<TCommand, TImage>): TScope | null;
  label?(change: CommandChange<TCommand, TImage>): string | null;
  compact?(commands: readonly TCommand[]): TCommand[];
}
```

### id

Unique per history, e.g. `"model"` or `"set:<id>"`. Steps refer to documents by id.

### document

The [`HistorySource`](#historysource) to record.

### keys

The document's [`HistoryKeys`](#historykeys).

### scopeOf(change)

The scope of a local change made outside a step, or `null` for no step.

### label(change)

Optional. The label of a step recorded with a `null` label, from its first change.

### compact(commands)

Optional. Rewrites a step's commands when it is filed into fewer that replay the same, such as one voxel patch per layer for a brush stroke.

## HistorySource

What the history needs from a document. A [`CommandDocument`](./CommandDocument.md) is one; see [custom history sources](./guides/collaborative-undo.md#custom-history-sources) for another.

```ts
interface HistorySource<TCommand, TImage> {
  readonly receipts: ChangeReceipts<CommandChange<TCommand, TImage>>;
  subscribe(event: "change", listener: (change: CommandChange<TCommand, TImage>) => void): () => void;
  subscribe(event: "reset", listener: (cause: DocumentResetCause) => void): () => void;
  applyStep(command: TCommand, basis: number): CommandChange<TCommand, TImage> | null;
}
```

## HistoryKeys

```ts
interface HistoryKeys<TCommand, TImage, TWritten = Iterable<string>, TCapture = KeyedSnapshot> {
  written(change: CommandChange<TCommand, TImage>): TWritten;
  guard(commands: readonly TCommand[]): HistoryGuard<TWritten, TCapture>;
}
```

`TWritten` is whatever the document compares cheaply: strings by default, packed pixels or voxel cells for documents with many small keys. `TCapture` is what its guard copies, a [`KeyedSnapshot`](#keyedguard) by default.

### written(change)

What a change wrote, including the entries holding what it touched.

### guard(commands)

The guard of the values replaying `commands` must find unchanged.

## HistoryGuard

```ts
interface HistoryGuard<TWritten = Iterable<string>, TCapture = KeyedSnapshot> {
  touches(written: TWritten): boolean;
  capture(): TCapture;
  same(captured: TCapture): boolean;
}
```

### touches(written)

Whether a change that wrote `written` hits a guarded value.

### capture()

A copy of the guarded values as they are now. A step keeps it across a close and reopen of its document, so it must not read the document later.

### same(captured)

Whether the guarded values still equal `captured`.

## KeyedGuard

The `HistoryGuard` of a few string keys. Values are compared as JSON; `undefined` means no value.

```ts
class KeyedGuard implements HistoryGuard<Iterable<string>, KeyedSnapshot> {
  constructor(entries: Iterable<KeyedGuardEntry>);
  readonly keys: IterableIterator<string>;
}

interface KeyedGuardEntry {
  readonly key: string;
  read(): unknown;
}
```

```ts
const guard = new KeyedGuard([
  { key: "hp", read: () => values.get("hp") }
]);
```

### keys

The guarded keys, for a document that guards named values beside its own written keys.

### KeyedSnapshot

What `capture()` returns: the JSON of each guarded value. `same(captured)` reads the values again and compares.
