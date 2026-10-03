---
status: accepted
---

# Mirrored variables read a cached value

A `ConsoleMirror` registers the variables of a console served on a `MessagePort`
([remote consoles](../remote.md)). `VariableDef.get()` is synchronous, and the console calls it in
four places: reading a variable, the hint of the highlighted suggestion, browse mode and value
completion. A port only answers asynchronously.

The mirror keeps the value of each variable from the latest snapshot, and its `get()` returns that
value. The server sends a snapshot after every command or write it runs, and an active mirror asks
for one when it becomes active and when the console emits `opened`. `VariableDef.set()` may return a
promise, so a write waits for the page, prints the value the page reads back and still reports a
rejection.

## Considered Options

- **An asynchronous `get()`.** Every hint, completion and browse row would wait on the page, and
  each of them would need a pending state.
- **The page pushes every value change.** Variables have no change event, and adding one would
  make every registrant notify the console.

## Consequences

- A value changed on the page by something other than the console, such as a brush slider, reads
  stale in an open console until the next command, write or reopening.
- `set` returning a promise is public API. A local variable may use it too; the echo stays
  pending until it settles.
