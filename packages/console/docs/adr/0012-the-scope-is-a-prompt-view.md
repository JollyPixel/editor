---
status: accepted
---

# The scope is a view for the prompt, not registry state

`/cd` stores a scope address on `CommandConsole`. The prompt, `submit()`, completion and browsing
read through `scoped`, a `ScopedRegistry` that tries `<scope>.<name>` before the name as given.
`registry` keeps resolving full addresses only.

`ConsoleServer` resolves addresses sent by a mirror, and `ConsoleMirror` checks whether a namespace
already exists. Both must mean the same thing whatever the user entered last, so the scope cannot
live in `Registry` itself.

## Considered Options

- **Scope inside `Registry`.** One lookup path, but a remote `brush.size` would resolve to
  `pixelart.brush.size` while the frame console sits in `pixelart`.
- **Rewriting the typed line to a full address before classifying it.** Completion and the echo
  would need to undo the rewrite, and root commands would need an escape.

## Consequences

- A name in the scope hides the same address at the root. Search inserts full addresses, which
  still resolve unless the scope holds the same name.
- When the scope's namespace is unregistered, `scope` falls back to the nearest registered parent
  and comes back with the namespace, so a mirror reconcile or hot reload does not reset it.
- The scope is not persisted, like the rest of the console
  ([ADR-0005](./0005-output-is-plain-text.md)).
