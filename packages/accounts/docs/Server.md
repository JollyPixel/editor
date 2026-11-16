# Server

Everything here is imported from `@jolly-pixel/accounts/node`.

## `Accounts`

The accounts of one server: the database, the identities, their sessions, avatars and preferences, and the server owner. Each project the server opens gets an [`AccountsRealm`](#accountsrealm) from it, which holds that project's members.

```ts
const accounts = await Accounts.open({
  location: ".jollypixel/accounts.db",
  cookie: new SessionCookie({
    name: "jolly_session_project"
  })
});
const realm = accounts.realm(projectId, {
  roles: new AccountRoles({
    roles: ["member", "spectator"],
    defaultRole: "spectator"
  }),
  join: "request"
});
```

### `Accounts.open(options)`

Opens an `AccountsDatabase` at `location` (in memory by default, see [`AccountsDatabase.open`](#accountsdatabaseopenlocation)) and builds the accounts over it. The other options are those of the constructor.

### `new Accounts(options)`

- `database`: an open `AccountsDatabase`. Disposing the accounts closes it, after disposing every open realm.
- `cookie`: a `SessionCookie`. Defaults to `new SessionCookie()`.
- `throttle.attempts`: failed logins allowed per username and per client address within `throttle.windowMs`. Defaults to 10.
- `throttle.registrations`: registrations allowed per client address within `throttle.windowMs`. Defaults to 10.
- `throttle.windowMs`: defaults to 15 minutes.
- `maxConcurrentHashes`: `scrypt` hashes and checks running at once. Further ones wait their turn, which keeps libuv threads free for file I/O. Defaults to 2.
- `masterPassword`: a secret the first account must give to register, while the database has no account. Without it, anyone who reaches the server first owns it. Both checks run before hashing, and later registrations ignore the secret. Throws a `RangeError` when empty.

### `realm(id, options)`

Opens the `AccountsRealm` of one project. `id` names the project in the database: its memberships, share links and agent tokens are stored under it, so reopening the same `id` finds them again.

- `roles`: the `AccountRoles` members may hold.
- `join`: the project's [`JoinMode`](./Accounts.md#joinmode). Defaults to `"request"`.
- `maxRequests`: access requests allowed to wait at once. A request past it is refused with `AccessRequestsFullError`. Defaults to 20.

Throws an `Error` while a realm with the same `id` is open. Disposing the realm frees the `id`.

### `login(body, requester)`

Signs an account in server-wide, whatever project it belongs to. `body` is a `CredentialsBody`, `{ username, password }`, and `requester` is a `Requester`, `{ address, secure, headers }`: the client address the throttle counts against, whether the request came over TLS, which makes the cookie `Secure`, and the request headers. Behind a reverse proxy, the host decides which forwarded address to trust.

Resolves to `{ account, cookie }`, where `cookie` is the `Set-Cookie` value of the new session, or throws `InvalidCredentialsError` or `AccountsThrottledError`, whose `retryAfterMs` gives the wait. A project page signs in with [`AccountsRealm.login`](#loginbody-requester-1) instead.

### `signOut(requester)`

Closes the session of the requester's cookie and [revokes](#watchrevocationslistener) its account in every open realm. Returns the `Set-Cookie` value that clears the cookie, also when the request had no session.

### `signedIn(headers)`

The `Account` of the request's session cookie, or `null`. The cookie of a request whose `Origin` does not match its `Host` is ignored.

### `account(accountId)`

The `Account` with that id, or `null`.

### `replaceAvatar(accountId, image)`

Encodes `image` with [`AvatarImage.encode`](#avatarimageencodeinput), stores it and resolves to the account with its new `avatar` path. Every open realm the account belongs to reports the new profile through [`watchProfiles`](#watchprofileslistener) and sends its roster again. Throws `InvalidAvatarError` for bytes that are not an image.

### `avatar(accountId)`

The stored avatar, `{ hash, bytes }`, or `null` when the account has none.

### `preferences(accountId)`

A `Map` from scope name to that scope's overrides, a JSON object. Scopes without overrides are absent. The accounts store the objects as given: the caller validates them.

### `replacePreferences(accountId, scope, overrides)`

Replaces the overrides of one scope. An empty object removes the scope.

### `cookie`

The `SessionCookie` the sessions live in.

## `AccountsRealm`

The members of one project, from [`Accounts.realm`](#realmid-options): who belongs to it, with which role, its access requests, share links and agent tokens, and what a host plugs into the project's HTTP and network servers. The server owner is a member of every realm, as `"admin"`, without a membership of its own.

### `register(body, requester)`

Registers an account for [`POST register`](#post-register) and gives it a membership in the realm, in one transaction: no account is created when the realm refuses it. `body` is a `RegistrationBody`, `{ username, password, masterPassword? }`, and `requester` is as in [`Accounts.login`](#loginbody-requester).

The first account of the server becomes its owner. Later ones follow the realm's `join` mode: `"open"` resolves to `{ status: "active", account, cookie }` with the new `Member` and its session, `"request"` to `{ status: "pending" }`, an access request without a session, and `"invite"` throws `InvitationRequiredError`. Every refusal listed under `POST register` throws an `AccountsError` with the code named there.

### `login(body, requester)`

Signs in for [`POST login`](#post-login). Resolves to `{ account, cookie }` with the `Member`, or throws `InvalidCredentialsError`, `AccountsThrottledError`, `AccountPendingError` while the account's request waits, or `MembershipRequiredError` for an account outside the realm. Neither of the last two opens a session.

### `signedIn(headers)`

The `Member` of the request's session cookie, or `null` without a session or for an account outside the realm or still pending.

### `member(accountId)`

The `Member` with that id, or `null` for an account outside the realm or still pending.

### `authenticate(request)`

The network `AuthenticationProvider`: pass the realm as the project server's `auth`. It reads the session from the cookie of a same-origin upgrade and resolves the member to:

```ts
{
  subject: member.id,
  role: member.role,
  profile: {
    username: member.username,
    peerId: member.id,
    avatar: "/api/accounts/<id>/avatar?v=<hash>"
  }
}
```

The `profile` overrides what the client claims on join, so a signed-in user cannot pose as another. A socket without a valid session, from an account outside the realm, or without a live share link of the realm, is refused.

A socket that offers a credential (`connectWebSocket({ credential })`) is read as a [share link](#sharelinks) token of the realm, then as an [agent token](#agenttokens) of the realm, and never falls back to the cookie. A live link resolves to a guest; a credential that is neither is refused:

```ts
{
  subject: "share:<link id>",
  role: GUEST_ROLE,
  profile: {
    username: "Guest",
    peerId: "<random UUID per connection>",
    avatar: null,
    via: "link"
  }
}
```

A live agent token resolves to its owner's current role in the realm, under the token's name. A token whose owner left the realm is refused:

```ts
{
  subject: "agent:<token id>",
  role: owner.role,
  profile: {
    username: token.name,
    peerId: token.id,
    avatar: null,
    via: "golem",
    ownerId: owner.id
  }
}
```

A new avatar reaches open connections through [`watchProfiles`](#watchprofileslistener).

`avatar` is always set, `null` without an uploaded image, so a client cannot claim an image of its own. Its path starts with `ACCOUNTS_URL_PATH`.

### `watchRevocations(listener)`

Calls `listener` with the account id after a role change or a removal in the realm's [`accounts` room](#accounts-room), and after a [`POST logout`](#post-logout) that closed a session. It returns a function that stops the calls. The network server watches it, so every open connection of that account is closed and authenticates again: a removed or signed-out account is refused, and a new role applies at once. A logout also reconnects the account's other devices, whose sessions stay valid.

It also calls `listener` with a link's guest subject, `share:<link id>`, when the link is revoked, expires, or its creator is removed from the realm, so its guests are disconnected and refused.

It calls `listener` with an agent subject, `agent:<token id>`, when the token is revoked, and for each live token of the realm whose owner's role changes or who is removed. A reconnecting agent then gets the owner's new role, or is refused. An ownership transfer revokes the new owner and its agents in every realm. A logout does not reach the account's agents.

### `watchDisconnections(listener)`

Calls `listener` with an agent subject, `agent:<token id>`, when its owner [disconnects](#disconnectownerid-tokenid) it, and returns a function that stops the calls. The network server watches it and closes the agent's connections as refused, so the agent does not reconnect on its own. Its token keeps working.

### `watchActivity(listener)`

Calls `listener` with an `AccountActivity` after each change made in the realm, and returns a function that stops the calls. Every activity names its `type` and the `actorId` of the account behind it:

```ts
type AccountActivity =
  | { type: "registered"; actorId; accountId; username; pending: boolean }
  | { type: "approved"; actorId; accountId; username; role }
  | { type: "denied" | "owner-transferred" | "removed"; actorId; accountId; username }
  | { type: "role-changed"; actorId; accountId; username; from; to }
  | { type: "share-link-created" | "share-link-revoked"; actorId; linkId; assetId }
  | { type: "agent-token-created" | "agent-token-revoked"; actorId; tokenId; name };
```

A registration is its own actor. A share link that expires reports nothing.

### `watchProfiles(listener)`

Calls `listener` with the account id and its new `profile`, shaped as in `authenticate`, after a member's [`PUT avatar`](#put-avatar). It returns a function that stops the calls. The network server watches it and sends the profile to every room the account's connections are in, without reconnecting them.

### `shareLinks`

The realm's [`ShareLinks`](#sharelinks).

### `agentTokens`

The realm's [`AgentTokens`](#agenttokens).

### `extension`

The [`accounts` room](#accounts-room), to register on the project's network server.

### `id`

The id the realm was opened with.

### `roles`

The current `AccountRoles`.

### `replaceRoles(roles, renamed?)`

Replaces the roles. Later role changes and approvals check the new ones, a stored role that is no longer declared reads as the new `defaultRole`, and the [`accounts` room](#accounts-room) sends its roster again. Open connections keep their role until they [authenticate](#authenticaterequest) again.

`renamed` maps old role names to new ones. Every member and access request of the realm that stores an old name moves to the new one, and each moved account is [revoked](#watchrevocationslistener). Throws `AccountChangeRefusedError`, before changing anything, when an old name is still in `roles` or a new name is not.

### `join`

The current [`JoinMode`](./Accounts.md#joinmode).

### `replaceJoin(join)`

Replaces the join mode for later registrations. Waiting requests stay.

### `holders(role)`

The ids of the members and access requests of the realm that store `role`. The owner holds no stored role.

### `[Symbol.dispose]()`

Stops the realm's timers and listeners and frees its id. Its data stays in the database.

## `ShareLinks`

The share links of one realm. A link opens only in its realm. Who may create a link is the host's rule.

### `create({ assetId, createdBy, expiresAt })`

Creates a link for `assetId` and returns the `ShareLink`, with a token of 256 random bits. The database keeps the token itself, so the link can be copied again; guard `ShareLink` values like the link they open. `expiresAt` is epoch milliseconds or `null`. Throws a `RangeError` for an expiry already past, and `ShareLinkRefusedError` when `createdBy` is not a member of the realm.

### `find(token)`

The live `ShareLink` of `token`, or `null`.

### `bySubject(subject)`

The live `ShareLink` of a guest subject, `share:<link id>`, or `null`. `shareLinkSubject(linkId)` builds the subject.

### `visibleTo(actorId)`

The live links an account may manage, oldest first: the ones it created, or every link of the realm for an admin of the realm.

### `revoke(actorId, linkId)`

Deletes the link and returns it. Only its creator or an admin of the realm may: anyone else gets `ShareLinkRefusedError`, and an unknown or expired link `ShareLinkNotFoundError`. Its guests are [revoked](#watchrevocationslistener). An expired link is deleted and revoked the same way when its time comes.

## `AgentTokens`

The agent tokens of one realm. A token lets a local AI agent connect to the realm's project as a peer with its owner's role there. Tokens never expire, and each member manages its own.

### `create({ ownerId, name? })`

Creates a token for `ownerId` and returns `{ token, value }`: the [`AgentToken`](./Accounts.md#agenttoken) and the credential, 256 random bits. The database keeps only a SHA-256 digest of `value`, so it cannot be shown again. `name` defaults to `"Golem"` and is trimmed to 1 to 32 characters. Throws `AgentTokenRefusedError` for a name out of bounds or an `ownerId` that is not a member of the realm.

### `find(value)`

The live `AgentToken` of a credential, or `null`.

### `bySubject(subject)`

The `AgentToken` of an agent subject, `agent:<token id>`, revoked or not, so an audit can name the agent behind an old edit. `null` for another subject or a token of another realm. Removing the owner from the realm revokes its tokens there.

### `ownedBy(ownerId)`

The live tokens of a member in the realm, oldest first.

### `revoke(ownerId, tokenId)`

Revokes a live token of `ownerId` and returns it. Its connections are [revoked](#watchrevocationslistener) and the credential stops working; the record stays for `bySubject`. Throws `AgentTokenNotFoundError` for a token of another account, an unknown id or a token already revoked.

### `disconnect(ownerId, tokenId)`

Closes the connections of a live token of `ownerId` and returns the token. They are [disconnected](#watchdisconnectionslistener), not revoked: the agent stays offline until it connects again, with the same credential. Throws `AgentTokenNotFoundError` like `revoke`.

## `AccountsDatabase`

The SQLite database (`node:sqlite`) that holds the accounts, their sessions, avatars and preferences, the server owner, and the memberships, share links and agent tokens of every realm. `Accounts` reads and writes it: a host only opens it.

### `AccountsDatabase.open(location?)`

Opens or creates the database at `location`, creating its directory. `":memory:"` (`IN_MEMORY_LOCATION`, the default) keeps everything in memory. File databases use WAL.

On POSIX systems, a directory it creates gets mode `0700`, and the database file is set to `0600` on every open, even when it already exists. SQLite gives the WAL and shared-memory files the mode of the database.

The database records its schema version. Opening one written with another version throws an `Error` that asks to delete it: there is no migration.

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

The cookie a browser session lives in: `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` when the host reports the request came over TLS. Page scripts never read the token.

```ts
new SessionCookie({
  name: "jolly_session_project",
  ttlMs: 7 * 24 * 60 * 60 * 1_000
});
```

- `name`: defaults to `DEFAULT_SESSION_COOKIE` (`"jolly_session"`). Cookies ignore ports, so two servers on one host need two names, or signing in to one signs out of the other.
- `ttlMs`: lifetime of a session, both the cookie's `Max-Age` and the server-side expiry. Defaults to `DEFAULT_SESSION_TTL_MS`, 30 days.

The token is 256 random bits, and the database keeps only its SHA-256 digest. A browser sends the cookie with any request, including a WebSocket a foreign page opens, so the cookie of a request whose `Origin` does not match its `Host` is ignored.

## `isCrossOrigin(headers)`

Whether the request has an `Origin` that does not match its `Host`. A request without `Origin` is same-origin, and one with an `Origin` but no `Host` is cross-origin. `SessionCookie` ignores the cookie of a cross-origin request, and a host answers it with 403 `cross-origin`.

## HTTP routes

The routes `AccountsClient` calls. The package does not serve them: the host mounts each entry of `ACCOUNTS_ROUTES` under `ACCOUNTS_URL_PATH`, checks JSON bodies against `credentialsBodySchema` or `registrationBodySchema`, and calls the `AccountsRealm` method of the same purpose for the project the request reaches, or the `Accounts` one for `logout` and the avatar routes. The studio serves them with Fastify.

Errors answer `{ code, message }`, where `code` is an `AccountsFailureCode`. Besides the codes of each route, a host answers 400 `invalid-request` for a body of the wrong shape or one with a `__proto__` or `constructor.prototype` key, 413 `payload-too-large` for a body over its limit, and 403 `cross-origin` for a request [`isCrossOrigin`](#iscrossoriginheaders) reports. `AVATAR_VERSION_PARAM` names the `?v=` parameter of avatar URLs.

### `POST register`

`{ username, password, masterPassword? }` creates an account with a membership in the project, sets the session cookie and answers 201 with `{ account }`, a `Member`. `password` must be a pre-hash from `prehashPassword` (43 base64url characters); anything else is refused with 400 `invalid-password`, so a plaintext password is never stored by mistake. A taken name answers 409 `username-taken`. A missing master password answers 403 `master-password-required` for the first account, and a wrong one 403 `invalid-master-password`. Later registrations ignore the master password and follow the project's join mode: under `"request"` the route stores an access request and answers 202 with no body and no cookie, or 429 `access-requests-full` past `maxRequests`, and under `"invite"` it answers 403 `invitation-required` before creating anything. The master password is sent as typed: the server holds it in plain form already. Every registration counts against the client address, whatever its outcome; past `throttle.registrations`, the route answers 429 `throttled` with `Retry-After`.

### `POST login`

`{ username, password }` sets a new session cookie and answers 200 with `{ account }`, or 401 `invalid-credentials`. With the right password, an account whose request waits answers 403 `account-pending` and an account outside the project 403 `membership-required`, both without a cookie; a wrong password still answers 401, so neither tells a guesser anything new. An attempt counts against both the username and the client address before its password is checked, so parallel requests cannot exceed `throttle.attempts`. Past the limit, the route answers 429 `throttled` with `Retry-After`, and the refused attempt counts for nothing. A success clears the username's count and gives the address its attempt back.

Anyone can lock a username out for `throttle.windowMs` by failing its login `throttle.attempts` times.

### `POST logout`

Closes the session, clears the cookie, revokes the account's open connections and answers 204.

### `GET me`

Answers `{ account }` for the session, or 401 `unauthenticated`.

### `PUT avatar`

The body is an image of at most 2 MiB (`AVATAR_MAX_BYTES`). It replaces the avatar of the session's account and answers 200 with `{ account }`. Without a session it answers 401 `unauthenticated`, past the limit 413 `payload-too-large`, and for bytes that are not an image 422 `invalid-avatar`.

### `GET <id>/avatar`

Answers the account's avatar as `image/webp`, or 404 `not-found`. No session is needed: account ids are random UUIDs. When `?v=` names the current hash, the reply is cached as `immutable` for a year; otherwise it is `no-cache`. `Cross-Origin-Resource-Policy: same-origin` keeps other sites from embedding it.

> [!WARNING]
> The pre-hash is still the credential: whoever reads it can sign in. Expose the routes over HTTPS only. Browsers also only provide `crypto.subtle` on HTTPS and localhost.

## `accounts` room

A roster for every member of the realm, and membership management for its admins.

Every member receives `accounts:roster` on join and again whenever a member connects or disconnects or the realm's members change, including a new avatar. `accounts` lists the owner and the members of the realm; `owner` marks the server owner. `requests` lists the access requests, oldest first, to admins only; other members receive an empty list:

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
- `accounts:deny` with `username`, which deletes an access request and keeps the account
- `accounts:remove` with `username`, which drops the membership with the member's share links and agent tokens in the realm, and keeps the account
- `accounts:transfer-ownership` with `username`, from the owner only, to a member of the realm. The previous owner becomes an admin of every realm in the database and every open one

The room answers commands only when the sender is an admin of the realm now, or the owner for a transfer, whatever role its socket connected with and whatever the rights table allows. A sender who is not is refused before the target is looked up. `role` must be declared. `assign-role`, `remove` and `transfer-ownership` refuse an access request and an account outside the realm like an unknown one, `approve` and `deny` refuse anything but an access request, and the owner's role cannot be changed nor the owner removed. Assigning a role or removing a member [revokes](#watchrevocationslistener) its open connections, and a transfer revokes those of the new owner.
