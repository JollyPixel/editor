# History architecture

`CommandHistory` listens to registered documents, groups their local changes
into steps, and undoes a step by applying its inverse commands as new local
edits. A step a peer has overwritten is refused, never half undone.

```mermaid
flowchart TB
    Editor["Editor"] -->|"record · open · undo · redo"| History["CommandHistory"]
    History -->|"change · refused · skipped"| Editor
    Document["HistorySource<br/>CommandDocument or custom"] -->|"change · reset"| History
    History -->|"applyStep(command, basis)"| Document
    Sync["Sync client"] -->|"confirm · refuse · discard"| Receipts["ChangeReceipts"]
    Receipts --> History
```

History never talks to the server: a sync client sends the undo like any other
local edit, and reports the server's answers through the document's receipts.

| Folder | Holds |
| --- | --- |
| `src/document` | `CommandDocument`, the `CommandChange` it emits and the `ChangeReceipts` a sync client writes |
| `src/history` | `CommandHistory`, `HistoryScopes` holding one `ScopeStacks` (undo and redo) per scope, `HistoryStep` with one `HistoryPart` per document and its `PartBasis`, `HistoryRegistration` and `KeyedGuard` |

## Incoming changes

```mermaid
flowchart TB
    Change["change from a document"] --> Origin{"origin"}
    Origin -->|"local"| Join["join the open step,<br/>or file its own in scopeOf(change)"]
    Origin -->|"local · replay"| Recapture["recapture the guards it touches"]
    Origin -->|"remote"| Refuse["refuse the settled steps it touches"]
```

| Event | Effect |
| --- | --- |
| `reset("load")` | refuses as `changed` the settled steps whose capture no longer holds |
| `reset("rewind")` | ignored, the pending commands replay right after |
| a change without inverse | joins no step |

## Step lifecycle

```mermaid
stateDiagram-v2
    [*] --> Open: open() · record()
    Open --> [*]: cancel() or nothing to undo
    Open --> Pending: commit()
    Pending --> Settled: every receipt in
    Pending --> Refused: server · dropped
    Settled --> Refused: peer · changed
    Settled --> Replayed: undo() · redo()
    Replayed --> Refused: server refuses the replay
```

- Without a sync client attached, a committed step is settled at once.
- Filing compacts each part and captures its guard; it also clears the redo stack.
- A replay is a new step on the other stack. If the server refuses it, it goes
  away and the original comes back refused.
- A step with no confirmed change yet replays with `basis` 0.

## Undo

```mermaid
flowchart TB
    Undo["undo(scope)"] --> IsOpen{"step open?"}
    IsOpen -->|yes| False["return false"]
    IsOpen -->|no| Next["newest step of the undo stack"]
    Next --> Check{"refused, closed<br/>or capture changed?"}
    Check -->|yes| Skip["emit skipped"] --> Next
    Check -->|no| Replay["applyStep each command,<br/>parts newest first"]
    Replay --> Applied{"any applied?"}
    Applied -->|yes| Filed["file on the redo stack,<br/>return true"]
    Applied -->|no| Gone["refuse as gone"] --> Skip
```

Every check passes or the whole step is skipped. Redo is the same with the stacks swapped.

## Receipts

| Receipt | Effect on the step |
| --- | --- |
| `confirmed(change, version)` | the change stops waiting; `basis` becomes the newest version |
| `refused(change)` | refused as `server` |
| `discarded()` | every step still pending on that document is refused as `dropped` |

See the [API docs](./README.md#-api) and the [glossary](./GLOSSARY.md) for
details.
