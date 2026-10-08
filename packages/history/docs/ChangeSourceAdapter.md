# ChangeSourceAdapter

Turns a source that emits plain changes into a history source with receipts. A renderer document reports what each edit wrote and how to undo it, with no dependency on this package; the host wraps it once and registers the adapter in a [`CommandHistory`](./CommandHistory.md).

```ts
import {
  ChangeSourceAdapter,
  CommandHistory,
  KeyedGuard
} from "@jolly-pixel/history";

const source = new ChangeSourceAdapter(document);
const history = new CommandHistory({ scopes: ["main"] });
history.register({
  id: "document",
  document: source,
  keys: {
    written: () => [],
    guard: () => new KeyedGuard([])
  },
  scopeOf: () => "main"
});
```

## Types

### ChangeSource

```ts
interface SourceChange<TCommand> {
  readonly command: TCommand;
  readonly origin: CommandOrigin;
  readonly inverse: readonly TCommand[];
  readonly clientId: string | null;
}

interface ChangeSource<TCommand> {
  subscribe(event: "change", listener: (change: SourceChange<TCommand>) => void): () => void;
  subscribe(event: "reset", listener: (cause: DocumentResetCause) => void): () => void;
  applyStep(command: TCommand): SourceChange<TCommand> | null;
}
```

`applyStep` applies an undo or redo command as a local change, emits it, and returns it, or `null` when the command no longer applies.

## Properties

### receipts: ChangeReceipts

The [receipts](./ChangeReceipts.md) a sync client attaches for this source.

## Methods

### adapt(change): CommandChange

The [`CommandChange`](./CommandChange.md) for a source change, created once and shared by every reader, so a sync client sends the same change the history recorded. A local change emitted during `applyStep` carries that step's `basis`.

### subscribe(event, listener): () => void

`change` forwards the source's changes as `CommandChange`s; `reset` forwards its resets.

### applyStep(command, basis): CommandChange | null

Calls the source's `applyStep` with `basis` set for the change it emits.

### dispose(): void

Stops following the source and drops every listener.
