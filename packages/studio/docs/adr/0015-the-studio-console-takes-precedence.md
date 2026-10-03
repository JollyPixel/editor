---
status: accepted
---

# The studio console takes precedence over editor consoles

The shell mounts the `jolly-console` of `editor.host`, with the same `theme` and `density`
variables an editor page registers. An editor page launched by the shell (a launch with a
`ShellChannel`, see [ADR-0004](./0004-the-shell-channel-is-one-way.md)) mounts no console:

- Ctrl+K inside the frame posts `{ type: "jolly-shell", command: "toggle-console" }`, and the shell
  toggles its own console. The console listens on its own window, and a focused frame keeps the
  keystroke from ever reaching the shell, hence the forward.
- The shell sends its theme and density in `jolly-launch`, then posts
  `{ type: "jolly-appearance", appearance }` to every loaded frame when its `jolly-scope`
  attributes change. The frame applies them to its own scopes before `mount`, so a frame never
  boots on another theme than the shell's.

A page opened directly, or framed by something else, keeps its own console as before.

The editor still receives a `CommandConsole` as `context.commands` and registers its features on
it, so editors do not branch on where they run. The studio console shows the namespaces of the
active editor ([ADR-0019](./0019-the-active-editor-namespaces-join-the-studio-console.md)).

## Considered Options

- **One console per frame and one for the shell.** Two Ctrl+K targets depending on focus, and a
  `theme` that restyles a single frame.
- **The shell writes the frames' scopes directly.** The frames are same-origin, so it would work,
  but the shell talks to frames through `postMessage` only
  ([ADR-0002](./0002-the-shell-consumes-data-only.md)), which keeps cross-origin editors possible.
- **Bridging editor commands into the shell console.** Needs a request and response channel for
  suggestions and output. Deferred at first, then built in
  [ADR-0019](./0019-the-active-editor-namespaces-join-the-studio-console.md).

## Consequences

- `mountStandalone` always reads the parent's `jolly-launch` before its other launch sources,
  offline included, so a framed page gets its shell channel in the static and e2e builds too.
- The shell now pushes a message on the channel, so [ADR-0004](./0004-the-shell-channel-is-one-way.md)'s
  "never replies" holds for commands only.
- An appearance change made by anything other than the console, such as a future settings pane,
  reaches the frames the same way, because the shell watches the scope attributes.
