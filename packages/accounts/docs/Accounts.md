# Accounts

## `Username`

A username as a value object.

### `Username.parse(input)`

Normalizes `input` to NFKC and trims it. It throws `InvalidUsernameError` unless the result has 2 to 32 characters, starts with a letter or a digit, and holds only letters, digits, `_`, `.` and `-`. Letters beyond ASCII are allowed.

### `value`

The name as typed, after normalization. It is what peers see.

### `key`

`value` in lowercase. Two usernames with the same `key` are the same account, and the password pre-hash is salted with it.

## `Account`

```ts
interface Account {
  id: string;
  username: string;
  role: string;
  avatar?: string;
}
```

`id` is a random UUID. The network server uses it as the peer `subject`, so the event store records it as the actor, and as the profile `peerId`, so a user keeps one presence colour everywhere. `role` is the effective role: a role that is no longer declared reads as the default one.

`avatar` is the same-origin path of the uploaded avatar, `<path><id>/avatar?v=<hash>`, absent until the account uploads one. It changes with the image, so it can be cached for good. `AVATAR_MAX_BYTES` (2 MiB) is the largest upload.

## `RosterEntry`

An `Account` with `online`, true while one of its studio shells is in the `accounts` room.

## `AccessRequest`

A registration waiting for an admin's approval: `{ id, username }`. Only admins receive them, through `AccountsRoster.requests`.

## `ADMIN_ROLE`

`"admin"`. Always a role: `AccountRoles` adds it, and the first registered account gets it.

## `AccountsError`

The base of every error an account rule throws. It carries a `code`, an `AccountsErrorCode`, and no HTTP status: the routes pick one when they answer. `InvalidUsernameError`, `InvalidPasswordError`, `InvalidAvatarError`, `UsernameTakenError`, `MasterPasswordRequiredError`, `InvalidMasterPasswordError`, `AccountPendingError` and `AccessRequestsFullError` extend it. `ACCOUNTS_ERROR_CODES` lists the codes.
