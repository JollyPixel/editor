---
status: accepted
---

# The active editor's namespaces join the studio console

The studio shows one console ([ADR-0015](./0015-the-studio-console-takes-precedence.md)), but the
editors register their namespaces (`brush`, `keybind`) on a console of their own page. Inside the
studio those commands were unreachable.

`jolly-launch` now carries its ports by name in `ports`, the catalog's and a second one for the
console. The frame serves the namespaces of its `context.commands` on it with a `ConsoleServer`
from `@jolly-pixel/console`. `EditorFrames` hands the shell's end to `FrameConsoles` from
`editor.host`, which keeps one `ConsoleMirror` per frame and activates only the active tab's on
the studio console:

| Active tab | Studio console |
|---|---|
| Home | the studio's own entries: `theme`, `density`, `/clear`, `/help` |
| an editor | the studio's own entries and that frame's namespaces |

Switching tabs, closing a tab or reloading a frame removes the previous frame's namespaces and
cancels any of its commands still running.

## Considered Options

- **Mirroring every open frame at once.** Two tabs of the same editor both register `brush`, and
  the commands of a hidden editor act on a view the user cannot see.
- **Reading the frame's `CommandConsole` directly.** The frames are same-origin, so it would work,
  but the shell talks to frames through messages only
  ([ADR-0002](./0002-the-shell-consumes-data-only.md)).
- **A message type on the launch port.** The catalog owns that port's messages
  ([ADR-0018](./0018-frames-read-the-catalog-through-the-shell.md)); a port per concern keeps
  the two protocols apart.

## Consequences

- Only namespaces cross. The frame's root entries, its own `/clear` and `/help`, stay in the
  frame, and the studio's root variables are the only `theme` and `density`.
- A frame namespace named like one the studio registers stays hidden, and `FrameConsoles` logs a
  warning. The studio registers no namespace today.
- A mirrored variable reads the value of the last snapshot. A value changed in the editor while
  the console is open reads stale until the next command, write or reopening
  ([console ADR-0008](../../../console/docs/adr/0008-mirrored-variables-read-a-cached-value.md)).
- An editor whose host predates the console port ignores it, and its namespaces stay hidden as
  before.
