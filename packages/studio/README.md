<h1 align="center">
  Studio
</h1>

<p align="center">
  One JollyPixel project, its assets and one editor per tab
</p>

## 📌 About

Private dev app that serves one asset back-end ([`@jolly-pixel/asset-server`][asset-server]) for every editor and opens each asset in its editor page. Design notes live in [ARCHITECTURE.md](./ARCHITECTURE.md) and the [ADRs](./docs/adr/README.md).

## 🚀 Running the studio

```bash
$ pnpm install
$ pnpm -r build
$ pnpm --filter @jolly-pixel/studio dev
```

The project root defaults to `project/`, seeded on first boot. A missing `.jollypixel/project.json` is written with every key at its default value. Set `JOLLY_PROJECT` to open another directory. The packages `.jollypixel/project.json` lists resolve from the project's `node_modules`, then from the studio's; an entry starting with `./` names a folder of the project. The dev server restarts when that file changes.

| Query parameter | Effect |
|---|---|
| `?offline` | Run the asset back-end in the browser (IndexedDB) |

## 👤 Accounts

The online studio asks everyone to sign in. The first account registered on a project becomes its owner and an admin; later ones get the project's default role. Accounts live in `.jollypixel/accounts.db`, which stays out of Git. Signing in needs HTTPS or `localhost`.

Roles are set in the `access` section of `.jollypixel/project.json`. Without it, the defaults below apply. `admin` is built in and cannot be declared.

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

Set `JOLLY_MASTER_PASSWORD` so that a stranger who reaches the server first cannot claim the admin account: the first registration must give it. When `access.accessRequests` is `true`, a later registration without it becomes an access request: the account cannot sign in until an admin approves it, and the studio refuses to start with that setting but no password. To change the password, restart with a new value. Without the variable, registration is open and the dev server warns at startup.

The Users pane on Home lists every account under its role and shows who is online. An admin changes a role or removes an account from its context menu, or with the `/users` console commands. Admins also see pending access requests in their own group, and approve one with a role or deny it, which frees the username. A role change applies on the user's next connection.

A crown marks the owner. No admin can change the owner's role or remove it. The owner can make another account the owner from its context menu or with `/users transfer`; that account becomes an admin, and the previous owner stays one.

To pick up editor, host or ui changes while the studio runs, start the watch builds in a second terminal:

```bash
$ pnpm --filter @jolly-pixel/studio dev:editors
```

For static hosting, build without an asset server and serve `dist/`:

```bash
$ pnpm --filter @jolly-pixel/studio build:static
```

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/studio test
$ pnpm --filter @jolly-pixel/studio typecheck
$ pnpm --filter @jolly-pixel/studio lint
$ pnpm exec playwright install chromium
$ pnpm --filter @jolly-pixel/studio test:e2e
```

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../CONTRIBUTING.md
[asset-server]: ../asset-server/README.md
