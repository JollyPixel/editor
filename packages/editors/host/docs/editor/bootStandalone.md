# bootStandalone

Entry point of an editor that can also run offline. It mounts online through
[`mountStandalone`](./mountStandalone.md), and on an in-page
[workspace](#offline-workspace) when asked to or when the asset server cannot
be reached. See the [architecture guide](../../ARCHITECTURE.md#offline).

```ts
void bootStandalone(VoxelMapEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "voxelMapEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const { createDefaultSeed } = await import("./boot/defaultSeed.ts");

    return createDefaultSeed();
  }
});
```

## Options

```ts
function bootStandalone<THandle extends EditorHandle>(
  definition: EditorDefinition<THandle>,
  options: BootStandaloneOptions
): Promise<StandaloneMount<THandle>>;

interface BootStandaloneOptions
  extends Omit<MountStandaloneOptions, "connect"> {
  offline: OfflineProjectLoader;
  forceOffline?: boolean;
}

type OfflineProjectLoader = () => OfflineProject | Promise<OfflineProject>;

interface OfflineProject {
  handlers: AssetKindHandler[];
  seed?: AssetSeedMap | (() => AssetSeedMap | Promise<AssetSeedMap>);
  backend?: AssetBackendTuning;
}
```

### offline

The asset kind handlers, seed and back-end tuning of the workspace. Called
only in the tab that owns the workspace, so import them dynamically.

### forceOffline

Skips the server. Pass `import.meta.env.MODE === "static"` for a static build.

### sources

Used by the online attempt only.

## Fallback

The editor goes offline at once with `forceOffline` or the `offline`
[query parameter](../params/QueryParams.md#host-parameters). Otherwise, when the
online mount throws `CatalogUnavailableError` or `LaunchNotFoundError`, a
dialog offers Retry or Open offline workspace. Cancelling rethrows the error,
and any other error is rethrown without asking. The runtime is created once
and reused by every attempt, since the canvas keeps its first context.

Offline, the editor mounts on the workspace named by the `workspace` query
parameter. Without it, the workspace is named after `definition.accepts`, so
editors of different kinds served from one origin each seed their own. The
parent's `jolly-launch` is still read first, so a page framed by the studio
keeps its shell channel.

A page that connects without `mountStandalone` uses the same dialog:

```ts
function offerOffline(message: string): Promise<"retry" | "offline" | null>;

function withOfflineFallback<TValue>(options: {
  message: string;
  online: () => Promise<TValue>;
  offline: () => Promise<TValue>;
}): Promise<TValue>;
```

`withOfflineFallback` retries `online` on Retry and runs `offline` on Open
offline workspace, with the same error rules as above.

## Share links

When the page carries an injected launch with a `credential`, as a studio
`/view/<token>` page does, `bootStandalone` mounts that launch only, with no
username prompt and no offline fallback. The server connects the page as a
guest and serves a read-only catalog of the target and its dependencies. When
the server refuses the socket because the link was revoked or expired, a
dialog offers to reload.

## Peer invites

A page whose URL fragment holds `#peer=<host>.<token>` opens as a guest of the
tab that issued it, before any share link or offline check. The guest reaches
that tab over an `RTCDataChannel`, uses its catalog and rooms like a follower
tab does, and opens no socket. The token travels on the data channel only, so
it never reaches a server.

The two tabs find each other through a BroadcastChannel, which limits invites
to one browser profile for now. No STUN or TURN server is configured. A dialog
offers to reload when the host does not answer within 20 seconds, revokes the
invite, or closes its tab.

### peerConsole

A [console feature](../../../../console/docs/features.md) for the owner tab of a
persistent workspace. `/peer.invite` prints a link to the current page with a
new invite, and `/peer.stop` revokes every invite and disconnects the guests.
Without `peers` it registers nothing.

```ts
registerConsoleFeatures(commands, [peerConsole], {
  peers: session.workspace?.peers
});
```

## Offline workspace

`@jolly-pixel/editor.host/offline` runs the asset back-end inside the page.
The editor mounts through the same `mount` as online, with a catalog, rooms
and leases.

```ts
const { openSharedTabWorkspace } =
  await import("@jolly-pixel/editor.host/offline");
const workspace = await openSharedTabWorkspace({
  project: () => ({
    handlers: [voxelMapAssetKind()],
    seed: {
      "maps/scratch.voxelmap.json": {
        id: crypto.randomUUID(),
        kind: VOXEL_MAP_KIND,
        content: () => encodeWorld()
      }
    }
  })
});

await mountStandalone(VoxelMapEditor, {
  sources: workspace.launchSources(VoxelMapEditor.accepts),
  connect: () => workspace.connect()
});
```

Import the entry dynamically so an online boot does not bundle the back-end.

`openSharedTabWorkspace({ project, name? })` opens the `jolly-workspace:<name>`
IndexedDB database (`name` defaults to `"default"`). One tab owns it; other
tabs use the owner's catalog and rooms over BroadcastChannel and never call
`project`. Without Web Locks, the workspace lives in memory.

The back-end's event log goes to a second database,
`jolly-events:jolly-workspace:<name>`. Each edit is written there when the
back-end records it, so a reload right after an edit keeps it even before the
asset itself is saved. `reset()` deletes both databases.

`seed` is applied only while the storage holds no asset, so a seeded asset the
user deleted does not come back. Give seeded assets random ids: a fixed id
makes every user's first asset the same, and their archives collide on
import.

### persistent

Whether the assets outlive the page.

### peers

Set on the owner tab only. `invite()` returns a new `PeerInvite`, whose
`toUrl(page)` writes it into the fragment of `page`. `guests` counts the
connected guests and `stop()` revokes every invite and disconnects the guests.

### connect()

Returns a guest identity, a client and the workspace. Destroying the last
client closes the workspace.

### launchSources(accepts)

The `?target=` when the workspace knows it, then the target last opened in
this browser, then the first catalog record of the `accepts` kind.

### reset()

Closes the workspace and deletes its database. `canReset` is `false` in a
follower tab.

### close()

Flushes, then stops the server and the back-end.
