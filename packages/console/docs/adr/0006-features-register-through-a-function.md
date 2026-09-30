---
status: accepted
---

# Features register through a function over a context

An editor registers from many features: the brush today, later layers, templates and world
commands. Wired into the boot class by hand, every feature would add a field, a call and a
teardown line there.

A feature is instead a `ConsoleFeature<TContext>`, a function from the console and a context to a
handle. The editor keeps one list and calls `registerConsoleFeatures` once. The returned handle
unregisters every feature in reverse order, and a feature that throws while registering rolls back
the ones before it.

Each feature types its context as the slice it reads, such as `Pick<VoxelMapWorkspace, "state">`,
so its spec builds that slice alone while the editor passes the whole workspace.

## Considered Options

- **A method on `CommandConsole`**, like `commands.registerFeatures()`. It behaves the same and
  ties the class to a list shape it has no other use for.
- **Living in `editor.host`.** The pixel-art library declares its keybind feature without
  depending on the host, and nothing in the contract is specific to editors.

## Consequences

One namespace per feature. Registering a namespace name again replaces it whole
([ADR-0003](./0003-last-registration-wins.md)), so two features sharing `brush` would drop each
other's entries.
