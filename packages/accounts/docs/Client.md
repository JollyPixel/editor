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

Creates an account, signs it in and resolves to a `RegistrationResult`: `{ status: "active", account }`, or `{ status: "pending" }` when the server stored an access request instead, without a session. Throws `InvalidPasswordError` without sending anything when the password is shorter than `MIN_PASSWORD_LENGTH` (8), and `InvalidUsernameError` for an invalid username.

`options` is a `RegisterOptions`. `options.masterPassword` is sent as typed. A server with a master password refuses the first registration without it with `master-password-required`, and a wrong one with `invalid-master-password`. When the server takes access requests, a registration without it resolves as pending, or rejects with `access-requests-full` when too many requests already wait.

### `login(username, password)`

Signs in and resolves to the `Account`. Rejects with `account-pending` while an admin has not approved the account.

### `logout()`

Closes the session.

### `me()`

The signed-in account, or `null` without a valid session.

### `replaceAvatar(image)`

Uploads a `Blob` as the signed-in account's avatar and resolves to the account, with its new `avatar` path. Throws `AccountsRequestError` with `payload-too-large` without sending anything when the image is over `AVATAR_MAX_BYTES`, and with `invalid-avatar` when the server cannot decode it.

## `prehashPassword(username, password)`

PBKDF2-SHA-256 with `PREHASH_ITERATIONS` (600,000) iterations, salted with `jolly-pixel:v1:` followed by the username's `key`. It resolves to 32 bytes in base64url. `AccountsClient` sends this instead of the password, so the plaintext never reaches the server or its logs.

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

Resolves once the access request named `username` is an active account with `role`.

### `deny(username)`

Resolves once the access request is deleted and its username freed.

### `remove(username)`

Resolves once the account is deleted.

### `transferOwnership(username)`

Resolves once the account named `username` is the owner and an admin. The previous owner stays an admin.

### `dispose()`

Leaves the room and rejects pending requests.

The commands reject with `AccountsRejectedError` when the server refuses them, including for a peer that is not an admin, a transfer from anyone but the owner, and a role change or removal of the owner.
