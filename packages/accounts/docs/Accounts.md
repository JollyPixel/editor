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
  owner: boolean;
  avatar?: string;
}
```

An identity on the server, whatever project it belongs to. `accountSchema` parses one.

`id` is a random UUID. The network server uses it as the peer `subject`, so the event store records it as the actor, and as the profile `peerId`, so a user keeps one presence colour everywhere.

`owner` is `true` for exactly one account once the first one registers: the owner of the server. It is an admin of every project, no one can change its role or remove it, and only the owner hands ownership to another account.

`avatar` is the same-origin path of the uploaded avatar, `/api/accounts/<id>/avatar?v=<hash>`, absent until the account uploads one. It changes with the image, so it can be cached for good. `AVATAR_MAX_BYTES` (2 MiB) is the largest upload.

## `Member`

An `Account` with the `role` it holds in one project. `memberSchema` parses one. `role` is the effective role: a role the project no longer declares reads as its default one, and the owner is always `"admin"`.

## `RosterEntry`

A `Member` with `online`, true while one of its studio shells is in the `accounts` room.

## `AccessRequest`

A request to join a project, waiting for an admin's approval: `{ id, username }`. Only admins receive them, through `AccountsRoster.requests`.

## `JoinMode`

How a project takes new members, one of `JOIN_MODES`:

- `"request"`: a registration creates an access request that the project's admins approve or deny.
- `"open"`: a registration becomes a member with the default role at once.
- `"invite"`: a registration is refused with `invitation-required`.

The first account of a server registers under any mode, since it owns the server.

## `ADMIN_ROLE`

`"admin"`. Always a role: `AccountRoles` adds it, and the owner holds it in every project.

## `GUEST_ROLE`

`"guest"`. The role of a connection opened with a [share link](./Server.md#sharelinks). No account holds it, so a host declares its rights apart from the roles accounts may hold.

## `ShareLink`

```ts
interface ShareLink {
  id: string;
  token: string;
  assetId: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number | null;
}
```

A link that lets people without an account open one asset. `token` is the credential the link carries, so anyone who reads it can open the asset. `createdBy` is the account id of its creator. Both times are epoch milliseconds; `expiresAt` is `null` for a link that never expires. `shareLinkSchema` parses one. A guest connected through it carries `via: "link"` (`SHARE_LINK_VIA`) in its profile.

## `AgentToken`

```ts
interface AgentToken {
  id: string;
  ownerId: string;
  name: string;
  createdAt: number;
}
```

A credential that lets a local AI agent join one project as a peer, with the role the account `ownerId` holds there. `name` is the peer name the agent shows, and `createdAt` is epoch milliseconds. The value of the credential is not part of it. `agentTokenSchema` parses one and `agentTokenNameSchema` a name (1 to 32 characters once trimmed, `AGENT_TOKEN_NAME_MAX_LENGTH`). An agent is named `"Golem"` (`AGENT_TOKEN_DEFAULT_NAME`) unless its token says otherwise. Its peer subject is `agent:<token id>`: `agentTokenSubject(tokenId)` builds it, and `agentTokenId(subject)` reads the id back, or returns `null` for any other subject.

## `AgentProfile`

```ts
interface AgentProfile {
  username: string;
  peerId: string;
  via: "golem";
  ownerId: string;
}
```

The profile of a connected agent: the name and id of its token, `via: "golem"` (`AGENT_TOKEN_VIA`) and the `ownerId` of the token. `parseAgentProfile(metadata)` reads it from a peer's metadata, or returns `null` for any other peer. `isAgentProfile(profile)` only checks `via`, which a chat entry also carries.

## `AccountsError`

The base of every error an account rule throws. It carries a `code`, an `AccountsErrorCode`, and no HTTP status: the host picks one when it answers. `InvalidUsernameError`, `InvalidPasswordError`, `InvalidAvatarError`, `UsernameTakenError`, `MasterPasswordRequiredError`, `InvalidMasterPasswordError`, `AccountPendingError`, `AccessRequestsFullError`, `InvitationRequiredError`, `MembershipRequiredError`, `ShareLinkNotFoundError`, `ShareLinkRefusedError`, `AgentTokenNotFoundError` and `AgentTokenRefusedError` extend it, and so do `InvalidCredentialsError` and `AccountsThrottledError`, exported from `@jolly-pixel/accounts/node`. `ACCOUNTS_ERROR_CODES` lists the codes.
