---
status: accepted
---

# Frames read the catalog through the shell

Supersedes [ADR-0004](./0004-the-shell-channel-is-one-way.md): the shell channel is no longer
one-way.

Every editor frame used to open its own catalog on its own connection, so the asset server sent
the whole catalog and dependency map once for the shell and once more for each frame. The shell
already holds that catalog.

`jolly-launch` now transfers a `MessagePort`. The frame keeps it as `shell.catalog`, a
`ShellCatalog`, and its session opens its `CatalogClient` there instead of on its own client.
Each catalog opened on that port gets a port of its own:

1. The frame posts `{ type: "jolly-catalog-open" }` with a new port on the launch port.
2. The shell's `CatalogShare` answers on the new port with a `catalog:snapshot` built from its
   own `CatalogClient`, then relays every message of its catalog room.
3. A command the frame sends goes out on the shell's catalog room. The reply comes back to the
   shell's connection, and the share forwards it to the port that sent its `requestId`.

The frame still opens its own connection for the asset rooms it leases. A launch without a port,
such as a page opened directly or framed by something else, opens its catalog on its own client
as before. The studio sends a port both online and offline.

The shell still never answers a `jolly-shell` command. New commands that need an answer get their
own port or message type, like the catalog.

## Considered Options

- **Relay the frame's whole connection through the shell.** One socket for the studio, but the
  server knows a room member by its connection, so the shell would have to multiplex every
  frame's asset rooms over its own. The catalog is the part every frame receives in full.
- **Keep one catalog per frame.** Costs a full catalog per open editor and per reload.

## Consequences

- A catalog command from a frame runs under the shell's connection, so the server sees the
  shell's identity. Both come from the same identity prompt.
- An early session (a frame URL with `?target=`) waits for the launch before it opens its
  catalog, since only the launch says whether a port comes with it. Its connection still opens
  right away.
- A frame's ports close when the shell answers its next `jolly-ready` or closes its tab.
