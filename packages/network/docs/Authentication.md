# Authentication

Who a connection is, decided once at the WebSocket handshake. [Rights](./Rights.md) then decides what that identity may do.

Authentication is configured on the server, never by the client. A client offers an opaque credential; the server decides what it means.

## Identity vs profile

Two distinct things travel with a peer:

| | Owner | Trusted | Carries |
|---|---|---|---|
| `PeerIdentity` | the server's authentication provider | yes | `subject`, `role` |
| `profile` | the client | no | anything (`username`, `peerId`, ...) |

`subject` is the event-store actor id for everything that connection writes. `role` is the key the rights table is indexed by. Neither is readable from a client payload — a `join` envelope claiming `profile: { role: "admin" }` changes nothing.

Peers see each other's `role` and `profile`. `subject` never leaves the server.

## Configuring

```ts
const server = new Server({
  rights: {
    viewer: { "voxel.renderer.*": "read" },
    editor: { "voxel.renderer.*": "write" }
  },
  defaultRole: "viewer",
  auth: new PasswordAuthentication({
    password: process.env.ROOM_PASSWORD!,
    role: "editor"
  })
});
```

`defaultRole` is what a client gets when nothing elevates it. It must name a role of `rights`; anything else throws `UnknownDefaultRoleError` at construction. With no `rights` and no `defaultRole`, an implicit `"default"` role applies and every event is `"write"` — the behaviour of a server that has never configured either.

The same options exist on `createWebSocketNetworkPlugin`.

## Providers

A provider turns a handshake into an identity, or refuses it.

```ts
interface AuthenticationProvider {
  authenticate(
    request: AuthenticationRequest
  ): PeerIdentity | null | Promise<PeerIdentity | null>;
}
```

`AuthenticationRequest` is `{ clientId, url, headers, defaultRole }` — deliberately not a `node:http` request, so a provider is testable and transport-independent. `clientId` is the id the connection will be known by; `defaultRole` is the server's, so a provider can fall through to it without holding a second copy.

Returning `null` refuses the connection.

### `BypassAuthentication`

The default when no `auth` is given. Every client becomes `{ subject: clientId, role: defaultRole }`.

### `PasswordAuthentication`

```ts
new PasswordAuthentication({
  password: "hunter2",
  role: "editor",
  mandatory: false
});
```

| Client offers | `mandatory: false` (default) | `mandatory: true` |
|---|---|---|
| the right password | `role` | `role` |
| nothing | `defaultRole` | refused |
| a wrong password | refused | refused |

Passwords are processed with Node.js `scrypt` and a random salt. Derived keys are
compared with `timingSafeEqual`, so the password itself is never retained for
comparison and digest comparison does not leak content or length through timing.

> [!WARNING]
> Nothing rate-limits attempts. A shared password on a socket anyone may retry against is guessable at speed, and `AuthenticationProvider` gives a provider nowhere to hang a lockout. Adequate for a dev server; not for an exposed one.

## The handshake

The client offers two subprotocols and the server selects the first, so the credential never appears in the response headers:

```
Sec-WebSocket-Protocol: jolly-pixel, jolly-pixel.auth.<base64url(credential)>
```

A client with no credential offers only `jolly-pixel`.

```ts
const client = new Client({
  url: "ws://localhost:5173/ws-sync",
  credential: password,
  profile: { username: "alice" }
});
```

`credential` is an opaque string. It is the password for `PasswordAuthentication` and would be the token for a future JWT provider; the client knows neither.

## Rejection

A refused connection completes the handshake and is then closed with code `4401` before any session or room exists. `Client` surfaces that as `"unauthorized"`:

```ts
client.on("unauthorized", () => promptForPassword());
```

The handshake is completed rather than answered with a 401 because browsers expose nothing about a failed upgrade response — no status, no body. A close code they can read.

## Lifetime

An identity is minted once and fixed for the life of the socket. A role cannot change mid-session, so a client's rights are resolved once at join and never revised. Reconnect to change role.
