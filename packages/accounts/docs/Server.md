# Server

Everything here is imported from `@jolly-pixel/accounts/node`.

## `Accounts`

The accounts of one server: the database, the roles and the session cookie, with what a host plugs into its HTTP and network servers.

```ts
const accounts = await Accounts.open({
  location: ".jollypixel/accounts.db",
  roles: new AccountRoles({
    roles: ["member", "spectator"],
    defaultRole: "spectator"
  }),
  cookie: new SessionCookie({
    name: "jolly_session_project"
  })
});
```

### `Accounts.open(options)`

Opens an `AccountsDatabase` at `location` (in memory by default, see [`AccountsDatabase.open`](#accountsdatabaseopenlocation)) and builds the accounts over it. The other options are those of the constructor.

### `new Accounts(options)`

- `database`: an open `AccountsDatabase`. Disposing the accounts closes it.
- `roles`: the `AccountRoles` accounts may hold.
- `cookie`: a `SessionCookie`. Defaults to `new SessionCookie()`.
- `path`: URL prefix of the HTTP routes, with a trailing slash. Defaults to `"/api/accounts/"`.
- `throttle.attempts`: failed logins allowed per username and per client address within `throttle.windowMs`. Defaults to 10.
- `throttle.registrations`: registrations allowed per client address within `throttle.windowMs`. Defaults to 10.
- `throttle.windowMs`: defaults to 15 minutes.
- `proxyHops`: reverse proxies in front of the server. Defaults to 0, which ignores `X-Forwarded-*` headers. With `n`, the server lists the entries of `X-Forwarded-For` followed by the socket address, and trusts the one `n` places before the socket address as the client address. It reads `X-Forwarded-Proto` the same way, with the socket scheme last, and the request counts as HTTPS when the trusted entry is `https`. Each proxy must append to both headers, or clients can pick the address they are throttled under.
- `maxConcurrentHashes`: `scrypt` hashes and checks running at once. Further ones wait their turn, which keeps libuv threads free for file I/O. Defaults to 2.
- `masterPassword.secret`: a secret the first account must give to register, while the database has no account. Without it, anyone who reaches the server first becomes admin. A wrong secret is refused even when none was needed, and both checks run before hashing. Throws a `RangeError` when empty.
- `masterPassword.accessRequests`: a later registration without the secret creates an access request, a pending account that an admin approves or denies in the [`accounts` room](#accounts-room). It cannot sign in until approved. Defaults to `false`.
- `maxAccessRequests`: access requests allowed to wait at once. A request past it is refused with `AccessRequestsFullError`. Defaults to 20.

### `handler`

A connect-style `(request, response, next)` middleware serving the [HTTP routes](#http-routes).

### `authenticate(request)`

The network `AuthenticationProvider`: pass the accounts as the server's `auth`. It reads the session from the cookie of a same-origin upgrade and resolves it to:

```ts
{
  subject: account.id,
  role: account.role,
  profile: {
    username: account.username,
    peerId: account.id,
    avatar: "/api/accounts/<id>/avatar?v=<hash>"
  }
}
```

The `profile` overrides what the client claims on join, so a signed-in user cannot pose as another. A socket without a valid session is refused: there are no anonymous peers. A new avatar applies on the next connection.

`avatar` is always set, `null` without an uploaded image, so a client cannot claim an image of its own. Its path starts with `path`.

### `watchRevocations(listener)`

Calls `listener` with the account id after a role change or a removal in the [`accounts` room](#accounts-room), and after a [`POST logout`](#post-logout) that closed a session. It returns a function that stops the calls. The network server watches it, so every open connection of that account is closed and authenticates again: a removed or signed-out account is refused, and a new role applies at once. A logout also reconnects the account's other devices, whose sessions stay valid.

### `extension`

The [`accounts` room](#accounts-room), to register on the network server.

### `roles`

The `AccountRoles` the accounts were built with.

### `cookie`

The `SessionCookie` the sessions live in.

## `AccountsDatabase`

The SQLite database (`node:sqlite`) that holds the accounts, their sessions and their avatars. `Accounts` reads and writes it: a host only opens it.

### `AccountsDatabase.open(location?)`

Opens or creates the database at `location`, creating its directory. `":memory:"` (`IN_MEMORY_LOCATION`, the default) keeps everything in memory. File databases use WAL.

On POSIX systems, a directory it creates gets mode `0700`, and the database file is set to `0600` on every open, even when it already exists. SQLite gives the WAL and shared-memory files the mode of the database.

A database written before ownership existed gets its oldest active admin as owner when it opens.

### `close()`

Closes the database. It is also `Disposable`.

## `AvatarImage`

An uploaded avatar, encoded for storage. Only `@jolly-pixel/accounts/node` loads `sharp`.

### `AvatarImage.encode(input)`

Decodes `input` with `sharp` and resolves to a 128px square (`AVATAR_SIZE_PX`) WebP: oriented from its EXIF tag, cropped to its center, with every metadata block dropped. An image smaller than 128px is scaled up with nearest-neighbour, so pixel art stays sharp. Only the first frame of an animation is kept. It throws `InvalidAvatarError` for bytes `sharp` cannot decode, or past 4096 by 4096 pixels.

### `hash`

The first 16 hex characters of the SHA-256 of `bytes`. Clients put it in the avatar URL, so a new avatar is a new URL.

### `bytes`

The WebP file.

## `AccountRoles`

The roles an account may hold.

```ts
new AccountRoles({
  roles: ["member", "spectator"],
  defaultRole: "spectator"
});
```

`"admin"` is always included. `defaultRole` must be one of the roles, or the constructor throws a `RangeError`.

### `has(role)`

Whether `role` is declared.

### `effective(role)`

`role` when it is declared, `defaultRole` otherwise. An account whose role was removed from the project connects with the default role instead of an unknown role, which the network rights table would treat as `"write"`.

### `[Symbol.iterator]()`

The roles, `"admin"` first.

## `SessionCookie`

The cookie a browser session lives in: `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` when the request came over TLS, directly or through the `proxyHops` proxies. Page scripts never read the token.

```ts
new SessionCookie({
  name: "jolly_session_project",
  ttlMs: 7 * 24 * 60 * 60 * 1_000
});
```

- `name`: defaults to `DEFAULT_SESSION_COOKIE` (`"jolly_session"`). Cookies ignore ports, so two servers on one host need two names, or signing in to one signs out of the other.
- `ttlMs`: lifetime of a session, both the cookie's `Max-Age` and the server-side expiry. Defaults to `DEFAULT_SESSION_TTL_MS`, 30 days.

The token is 256 random bits, and the database keeps only its SHA-256 digest. A browser sends the cookie with any request, including a WebSocket a foreign page opens, so the cookie of a request whose `Origin` does not match its `Host` is ignored.

## HTTP routes

Bodies are JSON with a `Content-Length` of at most 4 KiB, except for avatars. A body with a `__proto__` or `constructor.prototype` key answers 400 `invalid-request`. Errors answer `{ code, message }`, where `code` is an `AccountsFailureCode`. A request whose `Origin` does not match its `Host` answers 403 `cross-origin`, and a known route called with another method answers 405 `method-not-allowed` with `Allow`. Requests outside `path`, or on an unknown route, go to `next()`.

### `POST register`

`{ username, password, masterPassword? }` creates an account, sets the session cookie and answers 201 with `{ account }`. `password` must be a pre-hash from `prehashPassword` (43 base64url characters); anything else is refused with 400 `invalid-password`, so a plaintext password is never stored by mistake. A taken name answers 409 `username-taken`. A missing master password answers 403 `master-password-required` for the first account, and a wrong one 403 `invalid-master-password`. When `masterPassword.accessRequests` is set, a later registration without it stores an access request and answers 202 with no body and no cookie, or 429 `access-requests-full` past `maxAccessRequests`. The master password is sent as typed: the server holds it in plain form already. Every registration counts against the client address, whatever its outcome; past `throttle.registrations`, the route answers 429 `throttled` with `Retry-After`.

### `POST login`

`{ username, password }` sets a new session cookie and answers 200 with `{ account }`, or 401 `invalid-credentials`. A pending account with the right password answers 403 `account-pending` without a cookie; a wrong password still answers 401, so a pending username tells a guesser nothing new. An attempt counts against both the username and the client address before its password is checked, so parallel requests cannot exceed `throttle.attempts`. Past the limit, the route answers 429 `throttled` with `Retry-After`, and the refused attempt counts for nothing. A success clears the username's count and gives the address its attempt back.

Anyone can lock a username out for `throttle.windowMs` by failing its login `throttle.attempts` times.

### `POST logout`

Closes the session, clears the cookie, revokes the account's open connections and answers 204.

### `GET me`

Answers `{ account }` for the session, or 401 `unauthenticated`.

### `PUT avatar`

The body is an image of at most 2 MiB (`AVATAR_MAX_BYTES`), with a `Content-Length`. It replaces the avatar of the session's account and answers 200 with `{ account }`. Without a session it answers 401 `unauthenticated`, past the limit 413 `payload-too-large`, and for bytes that are not an image 422 `invalid-avatar`.

### `GET <id>/avatar`

Answers the account's avatar as `image/webp`, or 404 `not-found`. No session is needed: account ids are random UUIDs. When `?v=` names the current hash, the reply is cached as `immutable` for a year; otherwise it is `no-cache`. `Cross-Origin-Resource-Policy: same-origin` keeps other sites from embedding it.

> [!WARNING]
> The pre-hash is still the credential: whoever reads it can sign in. Expose the routes over HTTPS only. Browsers also only provide `crypto.subtle` on HTTPS and localhost.

## `accounts` room

A roster for every member, and account management for admins.

Every member receives `accounts:roster` on join and again whenever a member joins or leaves or the accounts change, including a new avatar. `requests` lists the access requests, oldest first, to admins only; other members receive an empty list:

```ts
{
  type: "accounts:roster",
  roles: string[],
  accounts: { id: string; username: string; role: string; owner: boolean; avatar?: string; online: boolean; }[],
  requests: { id: string; username: string; }[]
}
```

Commands carry a `requestId` and are answered with `accounts:applied` or `accounts:rejected` with a `reason`; the new roster follows an applied one.

- `accounts:assign-role` with `username` and `role`
- `accounts:approve` with `username` and `role`, for an access request
- `accounts:deny` with `username`, which deletes an access request and frees its username
- `accounts:remove` with `username`
- `accounts:transfer-ownership` with `username`, from the owner only

The room answers commands only when the sender's account is an admin now, or the owner for a transfer, whatever role its socket connected with and whatever the rights table allows. A sender who is not is refused before the target is looked up. `role` must be declared. `assign-role`, `remove` and `transfer-ownership` refuse an access request like an unknown account, `approve` and `deny` refuse anything but an access request, and the owner's role cannot be changed nor the owner removed. Assigning a role or removing an account [revokes](#watchrevocationslistener) its open connections, and a transfer revokes those of the new owner.
