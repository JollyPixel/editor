# Server

Everything here is imported from `@jolly-pixel/accounts/node`.

## `Accounts`

The accounts of one server: the store, the roles and the session cookie, with what a host plugs into its HTTP and network servers.

```ts
const accounts = await Accounts.open({
  location: ".jollypixel/accounts.db",
  roles: new AccountRoles({
    roles: ["member", "spectator"],
    defaultRole: "spectator"
  }),
  cookie: new SessionCookie("jolly_session_project")
});
```

### `Accounts.open(options)`

Opens an `AccountStore` at `location` (in memory by default, see `AccountStore.open`) and builds the accounts over it. `sessionTtlMs` goes to the store.

### `new Accounts(options)`

- `store`: an open `AccountStore`. Disposing the accounts closes it.
- `roles`: an `AccountRoles`.
- `cookie`: a `SessionCookie`. Defaults to `new SessionCookie()`.
- `path`: URL prefix of the HTTP routes, with a trailing slash. Defaults to `"/api/accounts/"`.
- `throttle.attempts` and `throttle.windowMs`: failed logins allowed per window. Default to 10 per 15 minutes.

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
    peerId: account.id
  }
}
```

The `profile` overrides what the client claims on join, so a signed-in user cannot pose as another. A socket without a valid session is refused: there are no anonymous peers. A role change applies on the next connection.

### `extension`

The [`accounts` room](#accounts-room), to register on the network server.

### `register(username, password)` and `login(username, password)`

Take a `Username` and a pre-hashed password, and resolve to `{ token, account }`. `register` hashes the pre-hash again with `scrypt`. `login` resolves to `null` for a wrong password or an unknown username, after the same `scrypt` work.

### `logout(token)`

Closes the session.

### `accountForToken(token)` and `accountById(id)`

The account, or `null`.

### `assignRole(username, role)`

Throws `AccountChangeRefusedError` when `role` is not one of `roles`, for an unknown account, or when it would demote the last admin.

### `remove(username)`

Deletes the account and its sessions. Throws `AccountChangeRefusedError` for an unknown account or the last admin.

### `[Symbol.iterator]()`

The accounts, oldest first.

### `"changed"` event

Emitted after `register`, `assignRole` and `remove`.

Every account the methods return carries its effective role: a role that is no longer declared reads as the default one.

## `AccountStore`

Users and their sessions in one SQLite database (`node:sqlite`). It stores what it is given and checks nothing against the roles.

### `AccountStore.open(location?, options?)`

Opens or creates the database at `location`, creating its directory. `":memory:"` (`IN_MEMORY_LOCATION`, the default) keeps everything in memory. File databases use WAL.

- `sessionTtlMs`: lifetime of a session. Defaults to 30 days.

### `register(username, hash, defaultRole)`

Inserts an account with `hash`, a `PasswordHash` from `hashPassword`. The first account of the database gets `"admin"`, decided inside the insert transaction. Others get `defaultRole`. Throws `UsernameTakenError` when another account has the same `username.key`.

### `credentials(username)`

The account and its `PasswordHash`, or `null`.

### `openSession(accountId)`

Mints a 256-bit token for the account and returns it. Only its SHA-256 digest is stored. Expired sessions are purged at the same time.

### `accountForToken(token)`

The account of a live session, or `null` for an unknown, closed or expired token.

### `accountById(id)`

The account, or `null`.

### `closeSession(token)`

Forgets the session. Unknown tokens are ignored.

### `assignRole(username, role)`

Stores `role` as is. Throws `AccountChangeRefusedError` for an unknown account or when it would demote the last admin.

### `remove(username)`

Deletes the account and its sessions. Throws `AccountChangeRefusedError` for an unknown account or the last admin.

### `size`

The number of accounts.

### `[Symbol.iterator]()`

The accounts, oldest first.

### `close()`

Closes the database. The store is also `Disposable`.

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

The cookie a browser session lives in: `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` when the request came over TLS. Page scripts never read the token.

```ts
new SessionCookie("jolly_session_project");
```

The name defaults to `DEFAULT_SESSION_COOKIE` (`"jolly_session"`). Cookies ignore ports, so two servers on one host need two names, or signing in to one signs out of the other.

### `read(headers)`

The session token, or `null`. A browser sends the cookie with any request, including a WebSocket a foreign page opens, so the cookie of a request whose `Origin` does not match its `Host` is ignored.

## HTTP routes

Bodies are JSON with a `Content-Length` of at most 4 KiB. Errors answer `{ code, message }`, where `code` is an `AccountsErrorCode`. A request whose `Origin` does not match its `Host` answers 403 `cross-origin`. Requests outside `path`, or on an unknown route, go to `next()`.

### `POST register`

`{ username, password }` creates an account, sets the session cookie and answers 201 with `{ account }`. `password` must be a pre-hash from `prehashPassword` (43 base64url characters); anything else is refused with 400 `invalid-password`, so a plaintext password is never stored by mistake. A taken name answers 409 `username-taken`.

### `POST login`

`{ username, password }` sets a new session cookie and answers 200 with `{ account }`, or 401 `invalid-credentials`. Failures count against both the username and the client address; past the limit, the route answers 429 `throttled` with `Retry-After`. A success clears the username's count.

### `POST logout`

Closes the session, clears the cookie and answers 204.

### `GET me`

Answers `{ account }` for the session, or 401 `unauthenticated`.

> [!WARNING]
> The pre-hash is still the credential: whoever reads it can sign in. Expose the routes over HTTPS only. Browsers also only provide `crypto.subtle` on HTTPS and localhost.

## `accounts` room

A roster for every member, and account management for admins.

Every member receives `accounts:roster` on join and again whenever a member joins or leaves or the accounts change:

```ts
{
  type: "accounts:roster",
  roles: string[],
  accounts: { id: string; username: string; role: string; online: boolean; }[]
}
```

Commands carry a `requestId` and are answered with `accounts:applied` or `accounts:rejected` with a `reason`; the new roster follows an applied one.

- `accounts:assign-role` with `username` and `role`
- `accounts:remove` with `username`

The room answers commands only when the sender's account is an admin now, whatever role its socket connected with and whatever the rights table allows. Removing an account closes its sessions but leaves its open sockets connected until they reconnect.
