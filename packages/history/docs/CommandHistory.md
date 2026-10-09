# CommandHistory

Per-person undo and redo over registered documents, one undo and redo stack per scope. See the [collaborative undo guide](./guides/collaborative-undo.md) for how steps are recorded, guarded and refused.

```ts
const history = new CommandHistory<"build" | "animate">({ limit: 50 });
const unregister = history.register({
  id: "model",
  document,
  keys: modelHistoryKeys(document.tree),
  scopeOf: () => "build"
});

history.record("build", "Rename Arm", () => document.rename(id, "Arm"));
history.undo("build");
```

## Constructor

```ts
new CommandHistory<TScope extends string>(options?: CommandHistoryOptions)
```

`TScope` names the histories. A scope starts with its first step, recorded or scoped by a registration, and `removeScope` drops it again. Until then `undo` and `redo` return `false` and `state` returns `EMPTY_HISTORY_STATE` for it.

### limit

`number`, `50` by default. Steps kept per stack; the oldest is dropped first. Throws `RangeError` when it is not a positive integer. Also exposed as a read-only property.

## Methods

### register(registration): () => void

Registers a document and returns its unregister. Throws when `registration.id` is already registered. See [`HistoryRegistration`](./HistoryRegistration.md).

### record(scope, label, edit): T

Runs `edit`, files the local changes it makes as one step of `scope`, and returns `edit`'s result. The step is filed even when `edit` throws. A `null` label takes the registration's `label(change)`.

### open(scope, label): OpenStep

Starts a step spanning several calls and returns `{ commit(), cancel() }`.

```ts
const step = history.open("build", "Paint");
// pointer moves edit the document
step.commit();
```

`commit()` files the step like `record`. `cancel()` closes it without filing; its changes stay applied. Both do nothing once the step is closed. Inside another step, `open` returns a handle that does nothing.

### undo(scope): boolean

Replays the newest step of the undo stack that is not refused and files the replay on the redo stack. Returns `false` when nothing was replayed, and always while a step is open.

### redo(scope): boolean

Same as `undo`, from the redo stack to the undo stack.

### state(scope): HistoryScopeState

The scope's current [state](#state).

### removeScope(scope): void

Drops `scope` and its steps, for a history that follows what is open, such as one scope per clip, then emits `change` with `EMPTY_HISTORY_STATE`. Does nothing when `scope` does not exist. Its next step starts it again. A step still open in it files nothing, and later receipts of its steps are ignored.

### dispose(): void

Unregisters every document, drops every step and removes every listener.

## Events

### change

```ts
(scope: TScope, state: HistoryScopeState) => void
```

Emitted when a scope's stacks change.

### refused

```ts
(scope: TScope, step: HistoryStepInfo) => void
```

Emitted when a step becomes refused.

### skipped

```ts
(scope: TScope, step: HistoryStepInfo) => void
```

Emitted when an undo or redo passes over a refused step.

## State

```ts
interface HistoryScopeState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undoCount: number;
  redoCount: number;
  refused: readonly HistoryStepInfo[];
}

interface HistoryStepInfo {
  readonly label: string | null;
  readonly refused: HistoryRefusal;
}

type HistoryRefusal =
  | { reason: "peer"; clientId: string | null; }
  | { reason: "server"; }
  | { reason: "closed"; documentId: string; }
  | { reason: "changed"; }
  | { reason: "gone"; }
  | { reason: "dropped"; };
```

Flags, labels and counts leave refused steps out. `refused` lists the refused steps of both stacks, newest first. Each reason is described in [refusals](./guides/collaborative-undo.md#refusals).

`EMPTY_HISTORY_STATE` is the frozen state of a scope with no steps, for a view that shows no history yet.

```ts
import { EMPTY_HISTORY_STATE } from "@jolly-pixel/history";
```
