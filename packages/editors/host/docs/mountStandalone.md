# mountStandalone

Boots an editor class in a page: finds the target, opens the
[session](./EditorSession.md), then calls the class's `mount`. See the
[architecture guide](../ARCHITECTURE.md#boot) for the sequence.

```ts
class VoxelModelEditor {
  static readonly accepts = VOXEL_MODEL_KIND;
  static readonly identity = { title: "Join voxel model" };
  static readonly kinds = [MODEL_TEXTURE_KIND];

  static async mount(context: EditorContext): Promise<VoxelModelEditor> {
    // ...
  }

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
  readonly kinds: Iterable<AssetModelKind<unknown>>;
  mount(context: EditorContext): Promise<THandle>;
}

interface EditorContext {
  launch: EditorLaunch;
  session: EditorSession;
}

interface EditorHandle {
  dispose(): void;
}
```

An editor class satisfies the definition with static members.

| Member | Role |
|---|---|
| `accepts` | the asset kind of the target; any other kind is refused |
| `identity.title` | title of the username prompt |
| `kinds` | dependency kinds the session leases with a synced [model](./AssetLeases.md#model-kinds) |
| `mount` | builds the editor from a connected session and returns its instance |

`context.launch.target` is the target's `AssetId`. The session belongs to the
editor once `mount` returns, so `dispose()` must call `session.dispose()`.

## Options

```ts
function mountStandalone<THandle extends EditorHandle>(
  definition: EditorDefinition<THandle>,
  options?: MountStandaloneOptions
): Promise<THandle>;

interface MountStandaloneOptions {
  sources?: Iterable<LaunchSource>;
  debugHandle?: string;
  connect?: () => StandaloneConnection | Promise<StandaloneConnection>;
}

interface StandaloneConnection {
  identity: PeerIdentity;
  client: EditorSessionClient;
}
```

`debugHandle` exposes the returned instance as `globalThis[debugHandle]`.

`connect` replaces the username prompt and the WebSocket client. It runs after
the launch is read, and the session destroys the returned client when it is
disposed or fails to open.

## Offline

`@jolly-pixel/editor.host/offline` runs the asset back-end inside the page, on
memory storage. The editor mounts through the same `mount` as online, with a
catalog, rooms and leases, and nothing outlives the page.

```ts
import { EditorLaunch, mountStandalone } from "@jolly-pixel/editor.host";

const { OfflineWorkspace } = await import("@jolly-pixel/editor.host/offline");
const workspace = await OfflineWorkspace.open({
  handlers: [voxelMapAssetKind({ chunkSize: 16 })],
  seed: {
    "maps/scratch.voxelmap.json": {
      id: "scratch",
      kind: VOXEL_MAP_KIND,
      content: () => encodeWorld()
    }
  }
});

await mountStandalone(VoxelMapEditor, {
  sources: [
    { read: async() => EditorLaunch.fromTarget("scratch") }
  ],
  connect: () => workspace.connect()
});
```

| Member | Role |
|---|---|
| `OfflineWorkspace.open({ handlers, seed? })` | seeds the memory source, then starts the back-end and its server |
| `connect()` | a guest identity and a loopback client; destroying the client closes the workspace |
| `backend` | the `AssetBackend`, for a host needing its handles |
| `close()` | stops the server and the back-end; safe to call twice |

The seed gives the target a fixed id, because the launch target injected by
the Vite plugin names an asset of the server's catalog, not of this one. Load
the entry with a dynamic `import()` so an online boot does not bundle the
back-end.

## Launch sources

By default the target is read from the first source that answers:

| Order | Source |
|---|---|
| 1 | `{ type: "jolly-launch", target }` posted by the parent frame, waited for 1000 ms |
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
`undefined` for anything else.

## Errors

| Error | From | Thrown when |
|---|---|---|
| `LaunchNotFoundError` | this package | no source answers |
| `AssetNotFoundError` | `@jolly-pixel/asset` | the catalog has no record for the target |
| `AssetKindMismatchError` | `@jolly-pixel/asset` | the target's kind is not `accepts` |

An error thrown by `mount` is rethrown after the session is disposed.
