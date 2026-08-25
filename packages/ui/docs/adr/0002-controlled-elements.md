---
status: accepted
---

# Controlled elements, stateful facade

Elements never own their value: they render `value` and emit an intent event, and the facade holds
the store and performs the write back. Local and remote edits then share one path — intent,
pipeline, new `value`, re-render — which mirrors `pixel-draw-renderer`'s `EditPipeline`.

An element may keep transient `draft` state (partial text, an expression, a drag origin) that wins
over incoming `value` while focused, so a remote edit cannot rewrite text under the caret. Enter
and blur commit, Escape discards.

## Considered Options

- **Self-mutating elements.** Remote edits fight the user mid-drag, needing a guard per control.
- **Optimistic apply with rollback.** A pending/confirmed state machine per control, unjustified
  before a real multiplayer editor exists.

## Consequences

A consumer that does not write a `jolly-change` value back sees the next render restore the old
value. That is the contract, not a bug.
