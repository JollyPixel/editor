---
status: accepted
---

# The shell answers a ready message with the launch

`HostMessageLaunchSource` used to wait one second for `jolly-launch` from the parent, then fall
back to the query string. The studio replaces that race with a handshake:

1. The editor page posts `{ type: "jolly-ready" }` to its parent once per allowed origin (the
   page's own origin by default), so another origin never learns the page is framed. A
   `jolly-launch` from an origin outside the list is ignored.
2. The shell answers with `{ type: "jolly-launch", target }`, addressed to its own origin.
   `EditorTabs` answers only messages coming from its own frames.

The timeout stays as the fallback for a page framed by something else, and the iframe URL also
carries `?target=`, so a shell too slow to answer still opens the right asset.

The message carries the target id only. Identity, tokens and settings join it later, in that order,
when each exists.

## Considered Options

- **Keep the timeout race.** Every tab would pay up to a second before booting, and a slow shell
  would boot the editor on the query string without a shell channel.
- **Query string only.** The target is then the only thing a launch can ever carry.
