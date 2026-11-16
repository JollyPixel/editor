# Hosting

## Static build

Build without an asset server and serve `dist/`:

```bash
$ pnpm --filter @jolly-pixel/studio build:static
```

## Hosted server

One Node.js process serves one project, or every project of a folder, behind a TLS reverse proxy. Build the workspace, then the studio, which compiles the shell and the editor pages in one Vite build, and start it:

```bash
$ pnpm -r build
$ pnpm --filter @jolly-pixel/studio build:hosted
$ pnpm --filter @jolly-pixel/studio start
```

To run it outside the workspace, `pnpm --filter @jolly-pixel/studio deploy --prod <dir>` after `build:hosted` writes a folder that starts with `node node/start.ts`.

`start` loads `.env` when the file exists and reads:

- `PORT` and `HOST`: the listening address, `127.0.0.1:3000` by default.
- `JOLLY_PROJECT`: the project folder, on a disk that survives restarts. The project answers at `/`.
- `JOLLY_PROJECTS`: a folder of projects instead, each one a subfolder holding `.jollypixel/project.json`. Set one of the two, not both. See [Several projects](#several-projects).
- `JOLLY_MASTER_PASSWORD`: see [Accounts](./accounts.md#master-password).
- `JOLLY_ALLOWED_HOSTS`: the public hostnames, comma-separated. A WebSocket upgrade for any other `Host` is refused, except localhost and IP addresses.
- `JOLLY_TRUST_PROXY`: `true`, or the proxy's addresses and CIDR ranges, comma-separated. The API then takes the client address from `X-Forwarded-For` and `https` from `X-Forwarded-Proto`. Without it, every user shares the proxy's rate limit and the session cookie is never `Secure`.
- `JOLLY_SOCKET_COMPRESSION`: `false` to send socket messages uncompressed. Deflate is on by default: it saves time below about 20 Mbit/s and costs about 300 ms per model open above it.

The builds write a `.br` and a `.gz` copy next to every JavaScript, CSS, HTML, SVG, JSON and WebAssembly file of 1 KB or more, and the server sends the one the client accepts. The proxy does not need to compress these files again.

The proxy must forward WebSocket upgrades on `/ws-sync`, or `/p/<slug>/ws-sync` with `JOLLY_PROJECTS`, with messages of up to 172 MB: a file of 128 MB, the most an asset kind accepts, travels as base64 in one message. Changes to `.jollypixel/project.json` apply on restart. On `SIGINT` or `SIGTERM` the server drops its connections, then closes the back-end.

Rooms live in process memory, events go to `node:sqlite` and clients keep WebSockets open, so the server needs a long-running Node 24 process with a persistent disk. Serverless platforms do not fit.

Play serves the player that `build:hosted` wrote to `dist/play/`, with the import map of the scripts the account opens written in. A game export (`GET /api/game/export`) ships the same player, found through `dist/.vite/manifest.json`. Rebuild the studio after changing the player or a runtime contribution.

Back up through `GET /api/project/archive` (`/p/<slug>/api/project/archive` in a projects folder) with an account allowed to export, or copy the project folder while the process is stopped. A copy taken while it runs can catch the SQLite WAL files halfway through a write.

## Several projects

With `JOLLY_PROJECTS=<dir>`, each subfolder of `<dir>` that holds `.jollypixel/project.json` is a project, named by its folder: `<dir>/castle/` answers at `/p/castle/`. A folder added while the server runs answers without a restart. The server keeps its own state, the accounts among it, in `<dir>/.jollypixel/`; each project keeps its assets, events and audit in its own `.jollypixel/`.

A project opens on its first request or socket and closes after 10 minutes with neither. A project that fails to open, for instance because it lists an editor the studio build lacks, answers its pages with the reason and leaves the others running. Two folders with the same `id` in `project.json`, as a copied folder has, refuse to open the second until one of them gets a new `id`.

`/` sends the browser to the projects page, which lists the projects of the signed-in account and the ones awaiting an admin's approval. The server owner sees every project there, the unreadable ones marked, and creates new ones: a new project starts from the studio's project file and seed assets. Deleting or renaming a project, or importing an archive as a new one, happens on disk while the server is stopped.
