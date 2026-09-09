# Catalog write path

Status: proposal. Nothing here is implemented.

`CatalogExtension` is read-only today: `onMessage` returns without doing
anything, and `AssetWriter` has no caller reachable from a browser. A
front-end asset tree needs to create, rename, move and delete assets, so the
catalog room has to accept commands.

This document sketches that path. It does not change the per-asset room
topology; see [Topology](#topology-why-the-split-stays).

## Shape

One writable room, `asset-catalog`, joined once by every client. Commands go
in, `AssetWriter` runs, and the existing `CatalogProjection` fan-out carries
the result back out.

```
client --command--> CatalogExtension.onMessage
                        |
                        v
                    AssetWriter.{create,rename,remove}
                        | appends asset.* lifecycle event
                        v
                    eventStore
                        | subscribe
                        v
                    CatalogProjection --"changed"--> broadcast catalog:changed
```

The return leg already exists. `CatalogExtension` subscribes to
`projection.on("changed")` in its constructor and broadcasts
`catalog:changed`. A successful write therefore reaches every member,
including the author, with no extra code — and reaches them through the same
path a seed write or a reconciler write takes, so browser-authored and
disk-authored changes are indistinguishable downstream.

## Commands

Client to server, on the `asset-catalog` room:

```ts
export const CATALOG_CREATE = "catalog:create";
export const CATALOG_RENAME = "catalog:rename";
export const CATALOG_DELETE = "catalog:delete";

export type CatalogCommand =
  | {
      type: typeof CATALOG_CREATE;
      path: string;
      kind?: string;
      content: AssetInlineContent;
    }
  | { type: typeof CATALOG_RENAME; assetId: string; to: string; }
  | { type: typeof CATALOG_DELETE; assetId: string; };
```

Notes:

- There is no `catalog:update`. Content changes belong to the per-asset room,
  which arbitrates them against live state and snapshots on a policy. Letting
  the catalog room write bytes would bypass both.
- There is no `catalog:move`. A move is a rename to a new path; the asset
  model has no folder entity and never had one. See [Folders](#folders).
- `content` reuses `AssetInlineContent` from `events/AssetEvents.ts` rather
  than a raw `Uint8Array`, so the command survives JSON transport unchanged
  and validates against `assetContentSchema`.

Server to client stays as it is: `catalog:snapshot` on join,
`catalog:changed` per applied lifecycle event. Failures use the room's
existing `denied` (RBAC) and `error` (infrastructure) envelopes rather than a
new result message — the client correlates by watching for the
`catalog:changed` that carries its path.

## Validation and rights

`CatalogExtension.getEventName` currently returns `CATALOG_CHANGED` when the
envelope fails to parse. That names an unparseable client payload after a
server-to-client event, which is the wrong bucket for a rights decision. It
should fall back to an explicit sentinel, the way `AssetRoomExtension` uses
`UNKNOWN_ASSET_ACTION`:

```ts
export const UNKNOWN_CATALOG_COMMAND = "invalid";
```

`events` must also grow the three command types, so a rights table can grant
`catalog:create` without granting `catalog:delete`:

```ts
override readonly events: readonly string[] = [
  CATALOG_SNAPSHOT,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_RENAME,
  CATALOG_DELETE
];
```

Path validation is already centralized: `AssetWriter` runs every path through
`writableAssetPath`, which rejects traversal and the `.jollypixel/` state
directory. The extension must not pre-validate paths itself; it passes them
through and surfaces the thrown `AssetPathEscapeError` as an `error`
envelope.

## The actor gap

`AssetWriter` needs an `EventStore.Actor` on every input. `RoomContext`
exposes `room` and `eventStore` but not the actor — `RoomContextFactory`
binds it privately inside `eventStore.append`, and the catalog write cannot
use that append because `AssetWriter` also touches the identity sidecar and
the projector.

Two ways to close this:

1. **Add `readonly actor: Actor` to `RoomContext`** in `@jolly-pixel/network`.
   `RoomContextFactory.create` already computes it via `resolveActor`; the
   change is exposing what it holds. One line, and it lets any extension
   attribute work without re-deriving identity.
2. **Derive it in `CatalogExtension`.** `onClientConnect` receives
   `PeerMetadata`; store `userId ?? clientId` per member and build the actor
   locally.

Prefer (1). Option (2) duplicates the userId-else-clientId rule in a second
place, and the two will drift.

## Folders

Paths are plain strings and folders are implicit — there is no folder record
in `@jolly-pixel/asset`, and this proposal does not add one. Consequences the
front-end tree has to absorb:

- The tree is derived by splitting `record.path` on `/`. It is a view, not
  state.
- An empty folder cannot exist, because nothing represents it. Creating a
  folder in the UI is a local, unsynchronized affordance until the first
  asset lands in it.
- Renaming a folder is N `catalog:rename` commands, one per contained asset.
  They are not atomic; peers will see the tree reshape progressively.

If empty and atomically-renamable folders turn out to matter, that is a
change to the asset model, not to this room.

## Interaction with per-asset rooms

- **Rename does not disturb an open room.** Room names are `kind:assetId`
  (`assetRoomName`), never paths. A rename changes the projected path and the
  identity sidecar; the live room and its folded state are untouched.
- **Delete does.** `AssetWriter.remove` appends `asset.deleted`, which the
  `AssetStateStore` subscription applies to any live state (the pixel handler
  calls `state.clear()`). Clients stay joined to a room whose asset no longer
  exists, and `registerAssetRooms` would now refuse to re-resolve it, so the
  room becomes a zombie that outlives its asset until the grace period
  expires.

  The catalog extension should not reach into the room registry to fix this.
  The cleaner fix is for deletion to be observable at the room layer — either
  `AssetRoomExtension` watching for `asset.deleted` on its own asset and
  broadcasting a terminal message so clients leave, or an explicit eviction
  hook on the server. Either way it is follow-up work, and it should be
  decided before `catalog:delete` ships.

## Topology: why the split stays

The catalog room is the tree; a `kind:assetId` room is an editing session for
one open document. The dividing line is metadata everyone needs versus
document state only editors need.

Collapsing per-asset rooms into the catalog room does not save the expensive
resource. The cost of an open asset is the folded state held by
`AssetStateStore` — a whole pixel buffer, a whole voxel world — replayed on
`acquire` and dropped on `release`. That cost follows the asset, not the
room. Rooms are what make the drop automatic: emptiness arms eviction, and
`onEvict` runs `scheduler.flush`, `projector.flush`, `states.release`. In one
room the same refcounting has to be rebuilt by hand.

Per-asset rooms also carry three things that are free today and are not free
to re-implement: presence scoped to one document, rights scoped by kind
(`ServerRoom` scopes by `extension.name`), and broadcast reaching only the
clients who opened that asset. On the last point the single-room design is
strictly worse — every stroke on any asset would fan out to every connected
client unless filtering is rebuilt inside the extension.

Rooms are also cheap in the way that matters most: `Client` opens **one**
WebSocket and multiplexes rooms through `Envelope.room`. A room is not a
connection.

## Worker threads

A worker thread per open asset would be a genuine resource problem, and
nothing structurally prevents one today.

`WorkerExtensionProxy` spawns its thread from its own constructor.
`Server.register` constructs one when handed a `WorkerExtensionDescriptor` —
that path is bounded, one worker per statically registered extension. The
unbounded path is the resolver: `RoomResolution.extension` is typed as plain
`Extension`, `WorkerExtensionProxy extends Extension`, and
`registerAssetRooms` calls `handler.createExtension(binding)`, an arbitrary
factory. A kind handler could therefore spawn one thread per open asset,
driven by client joins.

It leaks, too. `WorkerExtensionProxy` defines `close()` but no `dispose()`.
`ServerRoom.dispose` calls `extension.dispose?.()`, a no-op on the proxy, and
`Server.close` only closes proxies in `#workerProxies` — a list populated
solely by `register()`. A resolver-returned worker proxy would survive both
room eviction and server shutdown.

This is latent: no production handler implements `createExtension`; the only
callers are three test fixtures. Guards, in order of preference:

1. **Delete `AssetKindHandler.createExtension`.** `AssetRoomExtension` was
   built to replace it and covers every real handler. With it gone,
   `extensionFactory` can only construct an `AssetRoomExtension`, which
   spawns nothing. This removes the hazard rather than checking for it, and
   drops a branch from `registerAssetRooms` plus a paragraph from two docs.
2. If `createExtension` is kept, `registerAssetRooms` must refuse a
   resolution whose extension is worker-backed, alongside the existing
   `extension.id !== roomName` refusal.
3. Independently, `@jolly-pixel/network` should give `WorkerExtensionProxy` a
   `dispose()` that awaits `close()`. The leak is a defect on its own terms,
   reachable by any consumer with a room resolver, not just asset-server.

The catalog room itself is a statically registered, in-process `Extension`;
adding write commands to it introduces no worker.

## Open questions

- Should `catalog:create` accept content at all, or create an empty asset and
  leave the first write to the per-asset room? Accepting content matches
  `AssetWriter.create` and avoids a two-step create; rejecting it keeps all
  byte-writing in one place.
- What happens to a room whose asset is deleted — terminal broadcast, forced
  eviction, or nothing? See
  [Interaction with per-asset rooms](#interaction-with-per-asset-rooms).
- Does a rename need to be observable by the per-asset room, for a client
  that shows the document path in its title bar? It can subscribe to the
  catalog room for that instead.
