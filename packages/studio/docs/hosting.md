# Hosting

## Static build

Build without an asset server and serve `dist/`:

```bash
$ pnpm --filter @jolly-pixel/studio build:static
```

## Hosted server

One Node.js process serves one project behind a TLS reverse proxy. Build the editor pages and the shell, then start it:

```bash
$ pnpm -r build
$ pnpm --filter @jolly-pixel/studio build:hosted
$ pnpm --filter @jolly-pixel/studio start
```

To run it outside the workspace, `pnpm --filter @jolly-pixel/studio deploy --prod <dir>` after `build:hosted` writes a folder that starts with `node server/start.ts`.

`start` loads `.env` when the file exists and reads:

- `PORT` and `HOST`: the listening address, `127.0.0.1:3000` by default.
- `JOLLY_PROJECT`: the project folder, on a disk that survives restarts.
- `JOLLY_MASTER_PASSWORD`: see [Accounts](./accounts.md#master-password).
- `JOLLY_ALLOWED_HOSTS`: the public hostnames, comma-separated. A WebSocket upgrade for any other `Host` is refused, except localhost and IP addresses.
- `JOLLY_TRUST_PROXY`: `true`, or the proxy's addresses and CIDR ranges, comma-separated. The API then takes the client address from `X-Forwarded-For` and `https` from `X-Forwarded-Proto`. Without it, every user shares the proxy's rate limit and the session cookie is never `Secure`.

The builds write a `.br` and a `.gz` copy next to every JavaScript, CSS, HTML, SVG, JSON and WebAssembly file of 1 KB or more, and the server sends the one the client accepts. The proxy does not need to compress these files again.

The proxy must forward WebSocket upgrades on `/ws-sync`. Changes to `.jollypixel/project.json` apply on restart. On `SIGINT` or `SIGTERM` the server drops its connections, then closes the back-end.

Rooms live in process memory, events go to `node:sqlite` and clients keep WebSockets open, so the server needs a long-running Node 24 process with a persistent disk. Serverless platforms do not fit. Hosting several projects takes one process each and a router in front.

Back up through `GET /api/project/archive` with an account allowed to export, or copy the project folder while the process is stopped. A copy taken while it runs can catch the SQLite WAL files halfway through a write.
