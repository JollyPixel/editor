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
}
```

`debugHandle` exposes the returned instance as `globalThis[debugHandle]`.
An editor that boots without `mountStandalone`, such as an offline mode, does
the same with `exposeDebugHandle`:

```ts
function exposeDebugHandle(name: string, handle: unknown): () => void;
```

The returned function deletes the global, unless another value replaced it.

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
