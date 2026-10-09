# History glossary

Several people edit the same document at once, and each of them undoes only
their own edits. An undo writes back the values a step replaced, so it must
never erase newer work from someone else. When it would, the step is
**refused**: undo passes over it and says why, instead of undoing half of it.

Each term below describes the idea first. The *In code* line names where it
shows up in the API. The [architecture](./ARCHITECTURE.md) shows how the parts
fit together.

## Steps

### Scope

A named history with its own undo and redo stacks, usually one per editor tab
or tool. Undo in one scope never walks into another. A scope starts with its
first step.

*In code:* the `TScope` type parameter. A registration's `scopeOf(change)`
picks the scope of a local change made outside a step, and `removeScope(scope)`
drops a scope with its steps.

### Step

What one undo takes back: every local change made by one user action, such as
a click, a drag or a rename, across every registered document. Each document
gets its own **part** of the step, guarded and confirmed on its own.

*In code:* `record(scope, label, edit)`, or `open(scope, label)` for an action
spanning several calls. `HistoryPart` is a part.

## Guarding a step

### Guard

The watch a part keeps over the values its undo would write back. A change
**touches** the guard when it writes one of those values; a peer's change that
does refuses the step.

*In code:* `HistoryGuard`, built by `keys.guard(commands)` and tested with
`touches(keys.written(change))`. `KeyedGuard` is one for small
documents.

### Capture

A copy of the guarded values, taken when the step is filed and taken again
after each of this client's own writes to them. Undo checks the document still
holds it before writing anything, which catches writes no change reported.

*In code:* `HistoryGuard.capture()` and `same(captured)`; a `KeyedGuard`
captures a `KeyedSnapshot`.

### Refused step

A step undo can no longer take back without erasing someone else's work or
writing stale values. Nothing of it is undone: undo and redo skip it, and it
stays listed with its reason.

| Reason | When |
| --- | --- |
| `peer` | A peer wrote a value the step guards. |
| `server` | The server refused the step's edit, or its undo or redo. |
| `dropped` | The sync client threw the edit away unsent, past its offline bound. |
| `closed` | One of the step's documents is no longer registered. |
| `changed` | A guarded value changed through a write no change reported, such as a load or a moved voxel layer. |
| `gone` | The documents refused every command of the undo. |

*In code:* `HistoryRefusal`, `state(scope).refused` and the `refused` and
`skipped` events.

## Collaboration

### Origin

Where a change comes from: **local** for this person's edit, undo included;
**remote** for a peer's command; **replay** for this client's own pending
command applied again after a peer's. Only local changes make steps, only
remote ones refuse them.

*In code:* `CommandChange.origin`.

### Rewind

Rolling pending commands back so a peer's command can apply first; they replay
right after. Unlike a **load**, which replaces the state from a snapshot and
refuses the steps whose capture no longer holds, a rewind is ignored.

*In code:* `reset("rewind")` from `CommandDocument.revert()`, `reset("load")`
from `load()`.

### Pending

A part whose changes still wait for the server's answer, its **receipt**. The
server has not ordered them yet, so peer changes arriving meanwhile came first
and do not refuse the step. Once every answer is in, the part is **settled**.

*In code:* `ChangeReceipts`, written by the sync client.

### Basis

The room version an undo is based on: the newest version the server gave the
step's changes. The server refuses the undo if a peer wrote the same values
after it. Without a known version the basis is `0`, accepted only while this
client is still the last writer.

*In code:* `CommandChange.basis`, passed to `applyStep(command, basis)`.
