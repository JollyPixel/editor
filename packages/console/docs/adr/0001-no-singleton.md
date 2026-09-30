---
status: accepted
---

# No singleton: one instance per editor page, passed down

`CommandConsole` is a class and the package exports no instance. `editor.host` constructs exactly
one per editor page and hands it to the editor as `context.commands`. That is what "one console per
workspace" means.

`ui`'s `LogQueue` made the same choice for the same reasons
([ui ADR-0031](../../../ui/docs/adr/0031-a-log-is-not-a-toast.md)): two editors on one page, or
four parallel Playwright workers, must never share a registry. A module-level instance would also
leak registrations from one spec into the next, and the overwrite policy of
[ADR-0003](./0003-last-registration-wins.md) would hide the leak.

By convention the instance is named `commands`. A binding named `console` shadows the global and
takes `console.log` away from the file that declares it.

## Considered Options

- **A module-level instance.** The shortest registration code, and the reason every test would
  need a reset hook.
- **One console per runtime or per session.** The pixel-art editor can boot with no runtime, and
  the editor disposes its session itself. `EditorContext` is the one object every editor receives
  from the host, so the console travels there.
