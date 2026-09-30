---
status: accepted
---

# Output is plain text, and the console persists nothing

A scrollback entry's `text` is a string. `jolly-log` entries are Lit templates
([ui ADR-0031](../../../ui/docs/adr/0031-a-log-is-not-a-toast.md)), but the core cannot import
Lit, and strings keep the scrollback serialisable. The element renders `text` as a text node with
`white-space: pre-wrap`, so there is no markup sink and a peer's username in an entry is inert.

The scrollback (500 entries) and the input history (100 inputs) live on the instance. They survive
closing and reopening the console and are gone after a reload. The console writes nothing to
storage. A variable that should outlive a reload is persisted by its own setter, as pixel-art's
keybind variables are.

## Considered Options

- **Rich output** (links, tables, templates). Deferred until a command needs it; it would need a
  structured entry type the core can build without Lit.
- **Persisting the history.** Typed lines can contain anything, and persistence would make the
  console responsible for storage keys and quotas that its registrants already manage.
