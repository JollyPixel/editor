# Client

Everything here is imported from `@jolly-pixel/accounts` and runs in browsers and Node.js.

## `AccountsClient`

Calls the [HTTP routes](./Server.md#http-routes) a host serves for `Accounts`. The session lives in an HttpOnly cookie the browser sends on its own, so no method takes or returns a token.

```ts
const accounts = new AccountsClient({
  url: new URL("api/accounts/", document.baseURI)
});
```

- `url`: absolute URL of the routes, with a trailing slash.
- `fetch`: defaults to `globalThis.fetch`. Outside a browser, pass one that keeps cookies.

Failed requests throw `AccountsRequestError`, with the HTTP `status` and the server's `code`, an `AccountsFailureCode`: an `AccountsErrorCode` or an `AccountsRequestErrorCode` (`ACCOUNTS_ERROR_CODES` and `ACCOUNTS_REQUEST_ERROR_CODES` list them). A code the client does not know reads as `"unknown"`.

### `register(username, password, options?)`

Creates an account in the project the server serves, signs it in and resolves to a `RegistrationResult`: `{ status: "active", account }` with the `Member`, or `{ status: "pending" }` when the project stored an access request instead, without a session. Throws `InvalidPasswordError` without sending anything when the password is shorter than `MIN_PASSWORD_LENGTH` (8), and `InvalidUsernameError` for an invalid username.

`options` is a `RegisterOptions`. `options.masterPassword` is sent as typed. A server with a master password refuses its first registration without it with `master-password-required`, and a wrong one with `invalid-master-password`; later registrations ignore it. The project's [`JoinMode`](./Accounts.md#joinmode) decides the rest: a pending result, `access-requests-full` when too many requests already wait, or `invitation-required`.

### `login(username, password)`

Signs in and resolves to the `Member`. Rejects with `account-pending` while an admin has not approved the account's request, and with `membership-required` when the account does not belong to the project. Both rejections leave the account signed in on the server, ready for [`join()`](#join).

### `join()`

Enters the signed-in account into the project and resolves to a `RegistrationResult`, as [`register`](#registerusername-password-options) does. Rejects with `invitation-required` when the project takes members on invitation only, and with `unauthenticated` without a session.

### `logout()`

Closes the session.

### `me()`

The signed-in `Member`, or `null` without a valid session. Rejects with `membership-required` or `account-pending` for an account signed in on the server but not a member of the project.

### `replaceAvatar(image)`

Uploads a `Blob` as the signed-in account's avatar and resolves to the `Member`, with its new `avatar` path. Throws `AccountsRequestError` with `payload-too-large` without sending anything when the image is over `AVATAR_MAX_BYTES`, and with `invalid-avatar` when the server cannot decode it.

## `prehashPassword(username, password)`

PBKDF2-SHA-256 with `PREHASH_ITERATIONS` (600,000) iterations, salted with `jolly-pixel:v1:` followed by the username's `key`. It resolves to 32 bytes in base64url. `AccountsClient` sends this instead of the password, so the plaintext never reaches the server or its logs.

## `credentialsBody(username, password)`

Resolves to the `CredentialsBody` that `POST login` expects: the normalized username and the [pre-hashed](#prehashpasswordusername-password) password. Throws `InvalidUsernameError` for a username `Username.parse` refuses.

## `AccountsRoster`

A client for the `accounts` room. It is iterable over `RosterEntry` and emits `"change"` whenever the server pushes a roster.

```ts
const roster = AccountsRoster.join(client);
await roster.ready;
for (const { username, role, online } of roster) {
  console.log(username, role, online);
}
```

`AccountsRoster.join(rooms)` joins `ACCOUNTS_ROOM` on anything with a `room(name)` method, such as a network `Client`.

### `ready`

Resolves on the first roster.

### `roles`

The declared roles, `"admin"` first.

### `requests`

The `AccessRequest`s, oldest first. Empty unless the signed-in account is an admin.

### `assignRole(username, role)`

Resolves once the server stored the role. The new roster follows.

### `approve(username, role)`

Resolves once the access request named `username` is a member with `role`.

### `deny(username)`

Resolves once the access request is deleted. The account stays on the server.

### `remove(username)`

Resolves once the account no longer belongs to the project. The account stays on the server.

### `invite(username, role)`

Resolves once the existing account named `username` is a member of the project with `role`, its access request approved if it had one.

### `deleteAccount(username)`

Resolves once the account named `username` is gone from the server, for the server owner only.

### `transferOwnership(username)`

Resolves once the member named `username` owns the server. The previous owner stays an admin of every project the server knows.

### `dispose()`

Leaves the room and rejects pending requests.

The commands reject with `AccountsRejectedError` when the server refuses them, including for a peer that is not an admin, a transfer from anyone but the owner, and a role change or removal of the owner.
