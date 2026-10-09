# Collaborative undo

Several people edit the same document and each undoes only their own edits. An undo writes back the values a step replaced, so it must never erase a newer peer edit. When it would, the step is refused: undo passes over it and reports why, and nothing of it is undone.

The lifecycle diagrams are in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Steps and scopes

A scope is a named history with its own undo and redo stacks, usually one per editor tab or tool. Undo in one scope never walks into another. Scopes can also follow what is open, such as one per clip: a scope starts with its first step and `removeScope(scope)` drops it with its steps.

A step is what one undo takes back: every local change made by one user action, across every registered document. Each document gets its own part of the step, guarded and confirmed on its own.

- `record(scope, label, edit)` files the changes made during `edit` as one step.
- `open(scope, label)` keeps a step open across calls, for a drag over pointer events.
- A step opened inside another joins the outer one.
- A local change made outside any step becomes its own step in the scope its registration's `scopeOf(change)` returns. `null` means it makes no step.
- A change with an empty `inverse` joins no step.
- Filing a step clears the redo stack of its scope.

Undo is not a special operation: it applies the step's inverse commands as new local edits through `applyStep(command, basis)`, files them as a step on the redo stack, and the sync client sends them like any edit. Redo is the same with the stacks swapped.

## Origins

Every change carries an `origin`:

- `local` is this person's edit, undo and redo included. Only local changes make steps.
- `remote` is a peer's command. Only remote changes refuse steps.
- `replay` is this client's own pending command applied again after a peer's.

A document also emits `reset` when its state is replaced. A `"load"` replaces it from a snapshot and can refuse steps. A `"rewind"` rolls pending commands back so a peer's command applies first; they replay right after, so the history ignores it.

## Guards

Each part of a step guards the values its undo would write back, with one `HistoryGuard` built by the registration's `keys.guard(commands)`.

- A change touches the guard when `guard.touches(keys.written(change))` is true. A peer change that touches it refuses the step.
- The guard is captured (`capture()`) when the step is filed, and captured again after each of this client's own `local` or `replay` writes to it.
- Undo, redo and a `"load"` reset compare the document with the capture (`same(captured)`). This catches writes no change reported, such as a voxel layer moved under the step's cells.
- The guard comes from the document registered under the part's id at that moment, so a document closed and reopened under the same id keeps guarding its old steps.

`KeyedGuard` covers documents with a few string keys. Documents with many small keys use their own `TWritten`, such as packed pixels or voxel cells, and their own `TCapture`, such as typed arrays.

## Refusals

A refused step stays refused. Undo and redo skip it, emit `skipped`, and `state(scope).refused` lists it with its reason.

- `peer`: a peer change touched the guard.
- `server`: the server refused the step's edit.
- `dropped`: the sync client threw the edit away unsent, past its offline bound.
- `closed`: found on undo or redo, one of the step's documents is no longer registered.
- `changed`: found on undo, redo or a `"load"` reset, a guarded value no longer matches its capture.
- `gone`: the documents refused every command of the undo or redo.

When the server refuses or drops an undo or redo, the replayed step goes away and the original step comes back to its stack, refused.

Three things never refuse a step: a peer change arriving while the step still waits for its receipts (the server ordered the peer change first), this client's own changes, and a `"rewind"`.

## Receipts and basis

A part is pending while its changes wait for the server's answers. The sync client writes those answers to the document's `ChangeReceipts`; without an attached sync client, a step is settled as soon as it is filed.

- `confirm(change, version)` settles the change. The part's `basis` becomes the highest version confirmed so far.
- `refuse(change)` refuses the step as `server`.
- `discard()` refuses every step still pending on that document as `dropped`.

An undo is sent with the part's `basis`, and the server refuses it when a peer wrote the same values after that version. A part with no confirmed version replays with `basis` `0`, which the server accepts only while this client is still the last writer.

## Custom history sources

`CommandHistory` accepts any [`HistorySource`](../HistoryRegistration.md#historysource), not only a `CommandDocument`. A custom source must:

- emit `change` with a [`CommandChange`](../CommandChange.md) built by `CommandChange.local()`, `remote()` or `replay()`;
- emit `reset` with `"load"` or `"rewind"` when its state is replaced;
- apply undo and redo commands in `applyStep(command, basis)` as local changes carrying `basis`;
- expose `receipts` for its sync client.
