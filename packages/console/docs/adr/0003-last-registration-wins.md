---
status: accepted
---

# The last registration wins, and a handle only removes its own

Registering a name already in use replaces the earlier registration, with no error and no warning.
Re-registering a namespace replaces it whole. Every registration returns a handle, and
`unregister()` removes the entry only if it is still the one that handle created.

The identity check is what makes silent overwrites safe. A hot-reloaded feature registers
`/brush.grow` again, then the old copy disconnects and calls `unregister()`. Without the check that
call would delete the live command.

Built-ins follow the same rule, as `ui`'s built-in metrics and icons do
([ui ADR-0016](../../../ui/docs/adr/0016-built-ins-carry-no-privilege.md)). `/clear`, `/help` and
the host's `theme` are registered through the public API, and a host or editor can overwrite any
of them.

## Considered Options

- **Throwing on a duplicate name.** Hot reload would throw on every save, and the order in which
  hosts and editors register would become part of the API.
- **Warning on a duplicate name.** Every reload would log noise that nobody acts on.

## Consequences

A running command's `ctx.signal` aborts when its registration is removed or replaced while the run
is pending, so a command can stop work that belongs to code that is gone.
