---
status: accepted
---

# The shell channel is one-way and exists only after a parent launch

An editor reaches the shell through `context.shell`, a `ShellChannel` from `editor.host` that
posts commands to the parent:

```ts
{ type: "jolly-shell", command: "open-asset", target: string }
```

`context.shell` is `null` unless the launch came from the parent's answer to `jolly-ready`, so a
page framed by something else, or not framed at all, never posts into the void. The channel is
bound to the origin of that answer and posts only there.

The shell never replies to a command. A command that needs an answer gets its own message type
when it appears. The one message the shell pushes unasked is `jolly-appearance`, which the channel
hands to the page as `onAppearance`
([ADR-0015](./0015-the-studio-console-takes-precedence.md)). New commands are new members of the command union; title and dirty state are the
expected next two, and nothing is reserved by name.

`open-asset` runs exactly like a tree activation: it focuses the open tab or opens one, subject to
the registry and the tab cap.

## Considered Options

- **Adding the channel with its first caller.** The handshake had to change anyway, and binding the
  channel to the launch answer is simplest while that code is open.
- **A request and response channel.** No command needs an answer yet.

## Consequences

No editor calls the channel yet. The voxel-map Paint tab was the planned first caller until
tilesets were kept inside voxel-map ([ADR-0008](./0008-pixel-art-page-edits-pixelart-only.md)).
`editor.host` itself posts `toggle-console` on Ctrl+K
([ADR-0015](./0015-the-studio-console-takes-precedence.md)).
