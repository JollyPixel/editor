<h1 align="center">
  accounts
</h1>

<p align="center">
  User accounts and session tokens for JollyPixel servers
</p>

## 💃 Getting Started

```bash
$ pnpm add @jolly-pixel/accounts
```

## 👀 Usage example

On the server, one SQLite file holds the users and their sessions. The HTTP handler keeps the session in an HttpOnly cookie, and the network server reads that cookie on every WebSocket upgrade.

```ts
import { Server } from "@jolly-pixel/network";
import {
  Accounts,
  AccountRoles
} from "@jolly-pixel/accounts/node";

const accounts = await Accounts.open({
  location: ".jollypixel/accounts.db",
  roles: new AccountRoles({
    roles: [
      "member",
      "spectator"
    ],
    defaultRole: "spectator"
  })
});

const server = new Server({
  rights: {
    admin: {
      "*": "write"
    },
    member: {
      "*": "write"
    },
    spectator: {
      "*": "read"
    }
  },
  defaultRole: accounts.roles.defaultRole,
  auth: accounts
});
server.register(accounts.extension);

httpServer.on("request", accounts.handler);
```

In the browser, the client signs in and the socket carries the cookie on its own.

```ts
import {
  AccountsClient,
  AccountsRoster
} from "@jolly-pixel/accounts";
import { Client } from "@jolly-pixel/network/client";

const accounts = new AccountsClient({
  url: new URL("api/accounts/", document.baseURI)
});
const account = await accounts.me() ?? await accounts.login(
  "alice",
  "correct horse"
);

const client = new Client({
  profile: {
    username: account.username
  }
});
const roster = AccountsRoster.join(client);
```

## 📚 API

- [Accounts](./docs/Accounts.md): usernames, roles and the stored accounts.
- [Server](./docs/Server.md): `Accounts`, `AccountStore`, `AccountRoles`, `SessionCookie`, the HTTP routes and the `accounts` room.
- [Client](./docs/Client.md): `AccountsClient`, `prehashPassword` and `AccountsRoster`.

> [!NOTE]
> The package entrypoint is safe to import from browser code. Everything that
> touches SQLite or `node:crypto` lives under `@jolly-pixel/accounts/node`.

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Run these commands from the monorepo root:

```bash
$ pnpm --filter @jolly-pixel/accounts test
$ pnpm run lint
```

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../CONTRIBUTING.md
