---
status: accepted
---

# The session lives in an HttpOnly cookie

The online studio is always signed in: `@jolly-pixel/accounts` checks a session on every WebSocket
upgrade and refuses anonymous sockets. The shell and every editor frame must offer that session.

The session token is an `HttpOnly`, `SameSite=Strict` cookie, `Secure` over TLS. Login and
register set it, and no response body carries the token. The browser sends it on the shell's
upgrade and on each same-origin frame's, so `jolly-launch` carries the identity only and editors
never handle a credential.

## Considered Options

- **A token in `localStorage`, passed to frames in `jolly-launch`.** It needs no origin check,
  but any script on the page can read and keep it, and project packages run on that page
  ([ADR-0017](./0017-project-packages-are-trusted-code.md)).
- **A cookie without `HttpOnly`.** Same exposure as `localStorage`, with the cross-site risks of
  a cookie.

## Consequences

- A browser attaches the cookie to a WebSocket any page opens, and WebSockets ignore CORS. The
  server reads the cookie only from an upgrade whose `Origin` matches its `Host`, and the account
  routes answer 403 to any other origin.
- Cookies ignore ports, so two studios on one host would overwrite each other's session. The
  cookie is named after the project root.
- The cookie is the only carrier of the token: no route returns it, and neither the routes nor
  the socket accept it as a bearer or handshake credential.
- A refused socket signs out and reloads to the sign-in dialog; frames do not learn of their own
  refusal yet.
