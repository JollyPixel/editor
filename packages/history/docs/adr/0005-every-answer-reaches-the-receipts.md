---
status: accepted
---

# Every answer of the server reaches the receipts

`CommandSync` emits `acknowledged(command, version)` for every own command that leaves the ledger as
accepted, and `refused(command)` for a refused one, never both. Acknowledgements arrive through live
echoes, snapshot and correction `acks`, catch-up and resync echoes, and earlier entries a later echo
covers. `version` is exact for a live echo, an upper bound for a snapshot or catch-up, and
`undefined` for a correction. Client guards cover the gap an upper bound leaves.

A step part counts its pending changes. While one is pending, peer edits do not refuse the step,
since the server ordered them first, and its undo has no basis. Before, only live echoes with a
version confirmed anything, so many steps stayed pending forever and their undo overwrote peers.

Commands dropped past the offline bound emit `discarded`, and the history refuses every step still
waiting on that document as `dropped`. A catch-up that acknowledges an own command without its echo
asks for a snapshot and reports the command refused: the server refused it before the drop.

## Considered Options

- **Name the dropped refusal `offline`.** `dropped` says what happened to the edit, not why.

## Consequences

- `CommandSync` writes receipts by mapping each command sent with `sendChange` to its change, so
  every sync client of a history source does it the same way.
- A discard forgets the changes it dropped: a later receipt for one changes nothing, and the
  commands a catch-up dropped are no longer refused by the next snapshot.
