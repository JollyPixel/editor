# @jolly-pixel/studio — ROADMAP

Open work, in the order it should land. Decisions already taken are in the
[ADRs](./docs/adr/README.md). Each step ends with
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and
`pnpm run lint` green.

## 1. Accounts

Accounts are always on: the shell logs in once, the launch message carries a
token, and the network `AuthenticationProvider` checks it on upgrade.
Anonymous sockets are refused. Editors never learn how the identity was
obtained.

### 1a. Network

- Export `hashPassword` / `verifyPassword` from `@jolly-pixel/network/node`.
- `PeerIdentity` gets an optional server-owned `profile`, merged over the
  client's on join, so a logged-in user cannot claim another username.

### 1b. `@jolly-pixel/accounts`

New workspace. Network stays free of SQLite.

- `AccountStore` on `node:sqlite`: `users` (id, username unique without case,
  scrypt digest and salt, role) and `sessions` (SHA-256 of the token, user,
  expiry).
- `AccountAuthentication`: token → `{ subject: user.id, role, profile }`, so
  the event store records the user id as actor. An account whose role left
  the table connects with the default role.
- `createAccountsHandler`: connect middleware for `register`, `login`,
  `logout`, `me`. Login is rate-limited per username and IP; the socket only
  takes 256-bit tokens, so it needs none.
- `AccountsClient` (browser): pre-hashes the password with PBKDF2-SHA-256
  (Web Crypto), salted with `jolly-pixel:v1:<lowercased username>`. The
  server scrypts that again with a random salt.
- The first registered account becomes `admin`, inside the insert
  transaction.

Pre-hashing keeps the plaintext from the server and its logs. The hash is
still the credential: exposed servers need TLS, and `crypto.subtle` only
exists on HTTPS or localhost.

### 1c. Studio

- `project.json` gets an `access` section. Without it, the defaults below
  apply. `admin` is built in (`"*": "write"`) and cannot be declared, so a
  project cannot lock its admins out.

  ```json
  "access": {
    "defaultRole": "spectator",
    "roles": {
      "member": { "*": "write" },
      "spectator": {
        "*.$join": "write",
        "*.$presence": "write",
        "*": "read"
      }
    }
  }
  ```

- `defaultRole` is the role of new accounts and must name a role.
- `server/StudioAccess` parses `access` into `rights` and `defaultRole`;
  `vite.config.ts` hands them, with `AccountAuthentication`, to the workspace
  plugin. `vite/accountsPlugin` mounts the handler under `/api/accounts/`.
- The database is `.jollypixel/accounts.db`, added to the state
  `.gitignore` (asset-server's `ensureStateGitignore` takes extra entries).
  `e2e` uses `:memory:`; `static` has no accounts.
- The shell replaces the username prompt with a login / register dialog,
  keeps the token in `localStorage`, connects with
  `socket: () => connectWebSocket({ credential })`, and logs in again on
  `"unauthorized"`. The header toolbar shows the user and Sign out.
- `jolly-launch` carries the token beside the identity, which now comes from
  `me` instead of the prompt; editor.host passes the token to its `Client`.
  A token, not an HttpOnly cookie: no cross-site WebSocket
  hijacking to guard, and project packages are already trusted
  ([ADR-0017](./docs/adr/0017-project-packages-are-trusted-code.md)).
- Account management is an `accounts` room that answers only `admin`
  (checked by the room, not the rights table), driven by a `/users` console
  namespace: `list`, `role <user> <role>`, `remove <user>`. A role change
  applies on the user's next connection.
- e2e: a helper registers through the API and seeds the token before the
  page loads; the existing suites use it.

Later: anonymous spectators, closed registration, a users view in the
settings pane.

## 2. Preferences and settings pane

A per-user store the shell owns, reached from the header toolbar. The open
tabs, the dock layout and the kind filter move there from `localStorage`.

## 3. Runtime tab

Another page in another iframe that plays the project. No editor contract
involved; its action goes in the header toolbar.

## 4. In-process editors

Mount editors in the shell's document instead of iframes. Waits for the
`EditorDefinition` revisit in the
[editor host roadmap](../editors/host/ROADMAP.md): `mount` takes a container,
not `document`.

## Waiting for a trigger

- **Shell commands from editors.** The host posts `toggle-console` on Ctrl+K,
  but no editor calls `context.shell` since the voxel-map Paint action was
  dropped. Title and dirty state are the expected next commands; add them
  when an editor needs the shell to show either.
