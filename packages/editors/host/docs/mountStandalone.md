# mountStandalone

Boots an editor class in a page: finds the target, opens the
[session](./EditorSession.md), then calls the class's `mount`. See the
[architecture guide](../ARCHITECTURE.md#boot) for the sequence.

```ts
class VoxelModelEditor {
  static readonly accepts = VOXEL_MODEL_KIND;
  static readonly identity = { title: "Join voxel model" };
  static readonly kinds = [TEXTURE_DOCUMENT_KIND];

  static async mount(context: EditorContext): Promise<VoxelModelEditor> {
    // ...
  }

  readonly ready: Promise<void>;
  readonly session: EditorSession;
  readonly runtime: Runtime;

  dispose(): void {
    this.session.dispose();
  }
}

await mountStandalone(VoxelModelEditor);
```

## Editor definition

```ts
interface EditorDefinition<THandle extends EditorHandle> {
  readonly accepts: string;
  readonly identity: { title: string; };
  readonly kinds: Iterable<AssetDocumentKind<unknown>>;
  mount(context: EditorContext): Promise<THandle>;
}

interface EditorContext {
  launch: EditorLaunch;
  session: EditorSession;
  shell: ShellChannel | null;
}

interface EditorHandle {
  readonly ready: Promise<void>;
  readonly session: EditorSession;
  readonly runtime: Runtime | null;
  dispose(): void;
}
```

An editor class satisfies the definition with static members.

| Member | Role |
|---|---|
| `accepts` | the asset kind of the target; any other kind is refused |
| `identity.title` | title of the username prompt |
| `kinds` | dependency kinds the session leases with a synced [document](./AssetLeases.md#document-kinds) |
| `mount` | builds the editor from a connected session and returns its instance |

`context.launch.target` is the target's `AssetId`. The session belongs to the
editor once `mount` returns, so `dispose()` must call `session.dispose()`.
`context.shell` is the [shell channel](#shell-channel) when a parent frame
launched the page, `null` otherwise.

The returned handle exposes the session and the `Runtime` of its 3D view,
`null` for an editor without one. `ready` resolves once the target document is
loaded and the scene has awoken; `mountStandalone` waits for it before
resolving, and disposes the handle when it rejects.

## Options

```ts
function mountStandalone<THandle extends EditorHandle>(
  definition: EditorDefinition<THandle>,
  options?: MountStandaloneOptions
): Promise<THandle>;

interface MountStandaloneOptions {
  sources?: Iterable<LaunchSource>;
  dev?: boolean;
  debugHandle?: string;
  connect?: () => StandaloneConnection | Promise<StandaloneConnection>;
}

interface StandaloneConnection {
  identity: PeerIdentity;
  client: EditorSessionClient;
}
```

`dev` enables the hooks meant for development builds; pass
`import.meta.env.DEV`. Once the handle is ready it is exposed as
`window.jollyEditor`, typed as `EditorHandle`, and as `globalThis[debugHandle]`
when `debugHandle` is set. A `username` query parameter is stored as the tab's
identity (see [`rememberQueryUsername`](./EditorSession.md#identity)) so the
prompt is skipped. Without `dev`, neither happens.

`connect` replaces the username prompt and the WebSocket client. It runs after
the launch is read, and the session destroys the returned client when it is
disposed or fails to open.

## Offline

`@jolly-pixel/editor.host/offline` runs the asset back-end inside the page. The
editor mounts through the same `mount` as online, with a catalog, rooms and
leases. On `"memory"` storage nothing outlives the page; on `"indexeddb"`
asset content and ids survive a reload.

```ts
import { mountStandalone } from "@jolly-pixel/editor.host";

const { openSharedTabWorkspace } =
  await import("@jolly-pixel/editor.host/offline");
const workspace = await openSharedTabWorkspace({
  handlers: [voxelMapAssetKind({ chunkSize: 16 })],
  seed: {
    "maps/scratch.voxelmap.json": {
      id: crypto.randomUUID(),
      kind: VOXEL_MAP_KIND,
      content: () => encodeWorld()
    }
  }
});

await mountStandalone(VoxelMapEditor, {
  sources: await workspace.launchSources(VoxelMapEditor.accepts),
  connect: () => workspace.connect()
});
```

| Member | Role |
|---|---|
| `OfflineWorkspace.open({ handlers, seed?, storage?, name? })` | opens the storage, seeds it when empty, then starts the back-end and its server |
| `openSharedTabWorkspace({ handlers, seed?, name? })` | opens the persistent workspace in one tab and connects other tabs to it over BroadcastChannel; resolves a `StandaloneWorkspace` |
| `StandaloneWorkspace` | the members below that every workspace shares: `persistent`, `connect()`, `launchSources()`, `reset()`, `close()` |
| `connect()` | a guest identity, a local or BroadcastChannel client and the workspace |
| `launchSources(accepts)` | a known `?target=`, then the target last opened in this browser, then the first catalog record of the `accepts` kind; await it for a shared follower |
| `storage` / `persistent` | direct workspaces expose both; shared workspaces expose `persistent` |
| `backend` | the `AssetBackend` on a direct `OfflineWorkspace` |
| `reset()` | closes the owner workspace and deletes its database; unavailable in a follower tab |
| `close()` | flushes, then stops the server and the back-end; safe to call twice |

Several clients can share one workspace. Destroying one client leaves the others
connected; destroying the last closes the workspace. Once closing starts,
`connect()` refuses new connections.

`storage` defaults to `"memory"`. `name` defaults to `"default"` and selects
the `jolly-workspace:<name>` database. `seed` is a seed map or a function
returning one, used only when the storage holds no asset: a seeded asset the
user deleted does not come back.

On `"indexeddb"`:

- Give seeded assets random ids. A fixed id would make the first map of every
  user the same asset, and their archives would collide on import.
- `openSharedTabWorkspace` uses the Web Lock to select one database owner.
  Other tabs use the owner's catalog and asset rooms over BroadcastChannel.
  When Web Locks are unavailable it returns a memory workspace.
- Direct `OfflineWorkspace.open` still falls back to memory in a second tab.
- Snapshots are taken after 500 ms of quiet and at most every 5 s, and pending
  ones are flushed when the page is hidden. A browser does not guarantee
  writes started while the page goes away, so the short delay is what bounds
  the loss.
- Boot works as on a fresh clone: the event log starts empty and the
  reconciler recreates every asset from the stored files, with the ids of
  `.jollypixel/assets.json`.

The launch target injected by the Vite plugin names an asset of the server's
catalog, not of this one, hence `launchSources`. `mountStandalone` remembers
the opened target of an offline session for the next launch. Load the entry
with a dynamic `import()` so an online boot does not bundle the back-end.

## Boot state

`mountStandalone` sets `data-editor-state` on `document.documentElement`:

| Value | When |
|---|---|
| `booting` | before the launch is read |
| `ready` | once `handle.ready` resolves, after the dev handle is published |
| `failed` | when any boot step throws |

The attribute is set in every build. `EDITOR_STATE_ATTRIBUTE` and
`DEBUG_HANDLE` (`"jollyEditor"`) name the attribute and the global.

```ts
await page.waitForFunction(
  () => document.documentElement.dataset.editorState === "ready"
);
```

## Launch sources

By default the target is read from the first source that answers:

| Order | Source |
|---|---|
| 1 | `{ type: "jolly-launch", target }` posted by the parent frame in answer to the page's `{ type: "jolly-ready" }`, waited for 1000 ms |
| 2 | the `target` query parameter |
| 3 | the JSON element injected by the asset workspace Vite plugin's `launch` option |

`sources` replaces the list. A source returns `undefined` to pass to the next
one:

```ts
interface LaunchSource {
  read(): Promise<EditorLaunch | undefined>;
}

const fromHash: LaunchSource = {
  async read() {
    return EditorLaunch.fromTarget(location.hash.slice(1));
  }
};

await mountStandalone(MyEditor, { sources: [fromHash] });
```

`EditorLaunch.fromTarget(value)` accepts a non-blank string and
`EditorLaunch.parse(value)` an object with a `target` property. Both return
`undefined` for anything else. Both take an optional `ShellChannel` as second
argument, `null` by default, exposed as `launch.shell`.

## Shell channel

A page inside a frame posts `{ type: "jolly-ready" }` to its parent as soon
as the launch source starts reading, then waits for the parent's
`jolly-launch`. A launch that came this way carries a `ShellChannel` bound to
the parent and to the origin of its answer. The channel posts commands back
and never receives a reply:

```ts
class ShellChannel {
  readonly origin: string;
  openAsset(id: AssetId | string): void;
}
```

| Command | Message |
|---|---|
| `openAsset(id)` | `{ type: "jolly-shell", command: "open-asset", target: id }` |

`isReadyMessage(data)` and `isShellCommand(data)` narrow a message for a
shell that listens on its own window. A launch read from the query string or
the injected element has no channel, so `context.shell` is `null` and an
editor hides what only a shell can do.

## Errors

| Error | From | Thrown when |
|---|---|---|
| `LaunchNotFoundError` | this package | no source answers |
| `CatalogUnavailableError` | this package | the catalog does not answer before the connection timeout |
| `AssetNotFoundError` | `@jolly-pixel/asset` | the catalog has no record for the target |
| `AssetKindMismatchError` | `@jolly-pixel/asset` | the target's kind is not `accepts` |

An error thrown by `mount` is rethrown after the session is disposed.
