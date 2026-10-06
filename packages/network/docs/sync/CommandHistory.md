# CommandHistory

Per-person undo and redo over command documents, from `@jolly-pixel/network/client`. History is client-side: an undo sends ordinary commands through each document's `CommandSync`, carrying the `basis` of the step it undoes, so the server refuses an undo that would erase a newer peer edit (see [Conflicts](./Conflicts.md#lastwritewinsresolver)).

```ts
const history = new CommandHistory({
  scopes: ["build", "animate"],
  limit: 50
});
const unregister = history.register({
  id: "model",
  document,
  keys: modelHistoryKeys(document.tree),
  scopeOf: () => "build"
});

history.record("build", "Rename Arm", () => document.rename(id, "Arm"));
history.undo("build");
```

## Scopes and steps

`scopes` lists the named histories, each with an undo and a redo stack of at most `limit` steps (50 by default; the oldest is dropped first). `record(scope, label, edit)` files every local change `edit` makes, in any registered document, as one step of `scope`; nested calls join the outer step. A `null` label names the step after its first change, with the registration's `label(change)`. A local change made outside `record` becomes its own step in the scope the registration's `scopeOf(change)` names, labeled by its `label(change)`; when `scopeOf` returns `null`, the change makes no step. A new step drops the redo stack of its scope.

`undo(scope)` and `redo(scope)` replay the newest step that is not refused, as local edits that land on the other stack, and return whether one did. They pass over refused steps, emitting `skipped`. A step whose document is unregistered is refused as `closed`; one whose every command the documents refuse is refused as `gone`. Both return `false` while `record` runs.

`state(scope)` returns `{ canUndo, canRedo, undoLabel, redoLabel, undoCount, redoCount, refused }`: labels and counts leave refused steps out, and `refused` lists them newest first as `{ label, refused }`. `change` emits `(scope, state)`; `refused` emits `(scope, step)` when a step becomes refused. `dispose()` unregisters every document and drops every step.

## Refusals

A step guards the values its undo would write, as its registration's `keys.guards(commands)` names them: each guard has a `key` and a `read()`, and the step keeps the value each had when it ended. Guards are read through the document registered under the step's id at the time, so a document closed and reopened under the same id keeps guarding the steps filed before. A step becomes refused:

- `{ reason: "peer", clientId }` when a peer change writes one of those keys (`keys.written(change)`), or when a reset (a snapshot load) leaves one with another value (`clientId` is then `null`);
- `{ reason: "server" }` when the server refuses its edit. When it refuses the undo or redo of the step, the replayed step goes away and the step comes back refused.

A peer change arriving before the server confirmed the step was ordered before it, so it never refuses the step. This client's own changes never refuse a step: a local change, recorded or not, and a change with `origin` `replay` (this client's pending command re-applied by a reconciler) update the values the steps they write keep.

## Documents

`register(registration)` returns the unregister; ids are unique. A `HistoryRegistration<TScope, TCommand, TImage>` holds:

- `id`, e.g. `"model"` or `"set:<id>"`;
- `document`, a `HistorySource`: `receipts`, `subscribe("change" | "reset", listener)` and `applyStep(command, basis)`. A [`CommandDocument`](./CommandSync.md#commanddocument) is one;
- `keys`: `written(change)`, the keys a change wrote, including keys of the entries holding what it touched, and `guards(commands)`, `{ key, read() }` pairs whose values are compared as JSON;
- `scopeOf(change)`, the scope of a local change, or `null`;
- `label(change)`, optional, naming a step made of one change.

Changes are `CommandChange`s: `origin` `remote` is a peer change and names its peer with `clientId`, and a local change carries the `inverse` commands the step replays.

## Receipts

`ChangeReceipts<TChange>` carries the server's answers about local changes: `confirm(change, version)` and `refuse(change)` emit `confirmed` and `refused`. A local change waits for its receipt only while `attached` is true, that is while a sync client holds `attach()`'s detach; a second `attach()` throws. `DocumentSyncClient` attaches and writes the answers to the commands it sent.
