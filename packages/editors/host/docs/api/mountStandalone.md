# mountStandalone

`mountStandalone` boots an editor from its definition: launch, session, dev
options, then `mount`.

## API

```ts
interface EditorContext<TDev = NoDevOptions> {
  launch: EditorLaunch;
  session: EditorSession;
  dev: TDev;
}

interface EditorHandle {
  dispose(): void;
}

interface EditorDefinition<THandle extends EditorHandle, TDev = NoDevOptions> {
  readonly accepts: string;
  readonly identity: { title: string; };
  readonly kinds: Iterable<AssetModelKind<unknown>>;
  readonly dev?: DevOptions<TDev>;
  mount(context: EditorContext<TDev>): Promise<THandle>;
}

function mountStandalone<THandle extends EditorHandle, TDev>(
  definition: EditorDefinition<THandle, TDev>,
  options?: {
    sources?: Iterable<LaunchSource>;
    debugHandle?: string;
  }
): Promise<THandle>;
```

An editor class satisfies `EditorDefinition` with static members:

```ts
class VoxelModelEditor {
  static readonly accepts = VOXEL_MODEL_KIND;
  static readonly identity = { title: "Join voxel model" };
  static readonly kinds = [MODEL_TEXTURE_KIND];

  static async mount(context: EditorContext): Promise<VoxelModelEditor> {
    // ...
  }

  dispose(): void {
    // ...
  }
}

await mountStandalone(VoxelModelEditor);
```

`accepts` is the target kind, `identity.title` titles the username prompt and
`kinds` lists the dependency kinds the session leases with a model.

`sources` defaults to `defaultLaunchSources()`. Without `dev` the context
receives `{}`. `mountStandalone` disposes the session when `mount` throws, and
exposes the handle on `globalThis[debugHandle]` when given.
