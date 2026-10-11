---
status: accepted
---

# A refused session renews in place

The server checks the session cookie only when a socket opens
([ADR-0020](./0020-the-session-lives-in-an-httponly-cookie.md)). A socket opened after the session
expired or was signed out is closed as `unauthorized`, and the client stops retrying.

The shell used to sign out and reload on its own refusal. The reload dropped the changes still
waiting in each frame's `CommandSync`. A frame refused on its own, for example one opened after the
cookie expired while the shell's socket was still up, kept its suspended rooms and showed nothing.

Now every refusal goes through one `SessionRenewal` in the shell:

1. A frame's `ShellChannel` posts the `session-refused` shell command when its client is refused.
   The shell's own client reports its refusal directly.
2. The renewal asks the server for the current account (`me`). Another tab may have signed in
   already; otherwise it opens the sign-in dialog. Refusals that arrive meanwhile share that one
   renewal.
3. If the same account comes back, the shell calls `client.reconnect()` and posts
   `jolly-session-renewed` to every frame, which reconnects its own client. Rooms rejoin with their
   resume payload, so pending changes are sent again.
4. Another account, or a failed account check, reloads the page.

## Considered Options

- **Reload on every refusal.** Simplest, but it loses unsent changes, and a frame refused alone
  still has nobody to tell.
- **Pass a fresh token to frames.** The cookie is shared by every same-origin frame, so signing in
  once in the shell is enough; a token in a message would undo ADR-0020.

## Consequences

- `Client.reconnect()` is the only way out of a refusal; messages sent meanwhile are dropped, and
  rejoining carries presence and resume state instead.
- Signing out from the account menu still reloads.
- A page opened outside the studio has no shell to renew it, so its refused client stays closed.
