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
parameter (`"default"` without it). The parent's `jolly-launch` is still read
first, so a page framed by the studio keeps its shell channel.

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

`seed` is applied only while the storage holds no asset, so a seeded asset the
user deleted does not come back. Give seeded assets random ids: a fixed id
makes every user's first asset the same, and their archives collide on
import.

### persistent

Whether the assets outlive the page.

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
