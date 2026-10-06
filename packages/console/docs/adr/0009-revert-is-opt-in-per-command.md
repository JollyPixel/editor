---
status: accepted
---

# Revert is opt-in per command

`/revert [count]` undoes changes made from the console. The console can revert a variable write
by itself: it reads `get()` before `set()` and writes that value back. It cannot know what a
command changed, so a command opts in by returning a revert function from `execute`, in the way
an effect returns its cleanup. The function closes over whatever state it captured before the
change.

A change whose command or variable is no longer registered is skipped when `/revert` reaches it,
rather than dropped as soon as its registration goes away. A `ConsoleMirror` unregisters its
namespaces when deactivated and registers fresh ones when activated again, so dropping on
unregistration would forget a framed editor's changes on every studio tab switch.

## Considered Options

- **`ctx.onRevert(fn)` inside `execute`.** Same power, but less visible in the definition and easy
  to call twice.
- **A declarative `revert(args)` on `CommandDef`.** It only sees the arguments, not the state
  before the run, so `/keybind.reset` could not restore the previous shortcuts.
- **Reverting the last N submitted lines, failing on one that cannot be undone.** `/help` or a
  variable read would block every earlier change.
- **Dropping changes when their registration goes away.** Safer after a dispose, but loses
  mirrored changes on deactivation.

## Consequences

- An editor disposed and mounted again under the same addresses can receive a revert function
  captured by the first mount. Commands should guard their own state if that matters;
  `ConsoleServer` refuses a revert once the command that produced it is unregistered or replaced.
- There is no redo, and `/revert` itself is not recorded.
- Reverts are kept on the instance, like the history ([ADR-0005](./0005-output-is-plain-text.md)):
  the last 100, lost on reload.
