---
status: accepted
---

# Share links admit guests to one asset's closure

A share link lets someone without an account view one asset. The guest must not reach the
project tree, other assets, or any write.

`/view/<token>` serves the asset's built editor page with the launch injected server-side,
including the token as a credential. The page opens its socket with that credential in place of
the session cookie. The server resolves it to a guest identity with the built-in `guest` role, and
the network server's `admits` option lets that identity join only the `asset-catalog-view` room and the rooms of the asset's
dependency closure, recomputed at each join. The view room sends the closure's records only and
rejects every command.

## Considered Options

- **Inject the closure's records into the page.** No new room, but a dependency linked after
  the page loaded stays unknown until a reload.
- **Filter the real catalog room per peer.** One room fewer, but every catalog command and
  broadcast would need a guest check, and a missed one leaks the tree.
- **Give guests the project's `spectator` role.** A project can rename or widen that role, so
  guest rights would depend on project configuration.

## Consequences

- The socket accepts a share-link token as a handshake credential. A session token is still only
  read from the cookie.
- The token sits in the page URL and the injected launch. The page is sent with `no-store` and
  `no-referrer`. The database keeps the token itself, so its creator and admins can copy the
  link again: a link is read-only and revocable, and `accounts.db` is never served.
- Revoking a link, its expiry, or removing its creator disconnects the guests at once; the page
  then offers a reload, which answers 404.
- The asset-server's unauthenticated catalog and asset-file HTTP routes are turned off in the
  studio: they would expose everything a link hides.
