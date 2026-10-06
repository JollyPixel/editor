# mountStandalone

Boots an editor class in a page: finds the target, opens the
[session](./EditorSession.md), then calls the class's `mount`. See the
[architecture guide](../ARCHITECTURE.md#boot) for the sequence.

```ts
class VoxelModelEditor {
  static readonly accepts = VOXEL_MODEL_KIND;
  static readonly identity = { title: "Join voxel model" };
  static readonly kinds = [TEXTURE_DOCUMENT_KIND];

  static createRuntime(logger: HostLogger): Promise<EditorRuntime> {
    return EditorRuntime.create("#canvas", { logger });
  }

  static async mount(
    context: RuntimeEditorContext
  ): Promise<VoxelModelEditor> {
    // context.runtime is the EditorRuntime created above
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
type EditorDefinition<THandle extends EditorHandle> =
  | PageEditorDefinition<THandle>
  | RuntimeEditorDefinition<THandle>;

interface PageEditorDefinition<THandle extends EditorHandle> {
  readonly accepts: string;
  readonly identity: { title: string; };
  readonly kinds: Iterable<AssetDocumentKind<unknown>>;
  mount(context: EditorContext): Promise<THandle>;
}

interface RuntimeEditorDefinition<THandle extends EditorHandle> {
  readonly accepts: string;
  readonly identity: { title: string; };
  readonly kinds: Iterable<AssetDocumentKind<unknown>>;
  createRuntime(logger: HostLogger): Promise<EditorRuntime>;
  mount(context: RuntimeEditorContext): Promise<THandle>;
}

interface EditorContext {
  launch: EditorLaunch;
  session: EditorSession;
  shell: ShellChannel | null;
  logger: HostLogger;
  commands: CommandConsole;
}

interface RuntimeEditorContext extends EditorContext {
  runtime: EditorRuntime;
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
| `createRuntime` | optional; creates the editor's [`EditorRuntime`](./EditorRuntime.md) |
| `mount` | builds the editor from a connected session and returns its instance |

`mountStandalone` calls `createRuntime` as soon as the boot starts, so the
renderer starts up while the launch is read and the session connects. `logger`
is the `editor.runtime` namespace of the [boot trace](#boot-tracing). `mount`
receives the runtime as `context.runtime`. The runtime is disposed when the
boot fails before `mount` returns; after that it belongs to the handle.

`context.launch.target` is the target's `AssetId`. The session belongs to the
editor once `mount` returns, so `dispose()` must call `session.dispose()`.
`context.shell` is the [shell channel](#shell-channel) when a parent frame
launched the page, `null` otherwise. `context.logger` is the `editor`
namespace of the [boot trace](#boot-tracing), for the editor's own steps.
`context.commands` is the page's [console](#console).

The returned handle exposes the session and the `Runtime` of its 3D view,
`null` for an editor without one. `ready` resolves once the target document is
loaded and the scene has awoken; `mountStandalone` waits for it before
resolving, and disposes the handle when it rejects.

## Console

Once the launch is read, `mountStandalone` constructs one
[`CommandConsole`](../../../console/docs/CommandConsole.md) per page and
passes it to `mount` as `context.commands`. Where the console shows depends on
the launch:

- Without a [shell channel](#shell-channel), `mountConsole()` appends a
  `jolly-console` element to `document.body`, and Ctrl+K opens it.
- With a shell channel, the shell's console takes precedence. The page mounts
  no element, Ctrl+K posts the `toggle-console` command to the shell, and the
  page follows the shell's [appearance](#appearance). When the launch carries a
  [console port](#shell-console), the page serves the namespaces registered on
  `context.commands` there, and the shell shows them while the frame is its
  active editor. Without one, nothing displays them.

`mountConsole` registers two root variables:

- `theme`, an enum of `light`, `dark` and `auto`. A write sets the `theme`
  attribute of every `jolly-scope` on the page, and `auto` removes it so the
  scopes follow the system.
- `density`, an enum of `compact`, `default` and `comfortable`. A write sets
  the `density` attribute of every `jolly-scope` on the page.

A successful write is stored under `jolly-pixel:theme` or
`jolly-pixel:density`. `mountConsole` applies the stored values to every
`jolly-scope` before it registers the variables, so they survive a reload.
An invalid or missing value leaves the page's own attribute. A page with a
shell channel stores nothing and follows the shell.

When a boot step fails, the element is removed and every registration is
dropped, so the retry of the [offline fallback](#offline-fallback) mounts a
fresh console. Once the editor is ready the console stays for the life of the
page.

A page that boots without `mountStandalone`, such as the studio shell, mounts
the same console itself:

```ts
function mountConsole(options?: MountConsoleOptions): EditorConsole;

interface MountConsoleOptions {
  parent?: HTMLElement;
  storage?: StorageAdapter;
}

interface EditorConsole {
  readonly commands: CommandConsole;
  readonly element: HTMLElementTagNameMap["jolly-console"];
  dispose(): void;
}
```

`parent` defaults to `document.body`. `storage` is a `StorageAdapter` from
`@jolly-pixel/ui`, a `LocalStorageAdapter` by default. `dispose()` removes the
element and every registration.

An editor registers its namespaces as a list of
[console features](../../../console/docs/features.md) and unregisters them in
`dispose()`:

```ts
const features = registerConsoleFeatures(
  context.commands,
  [brushConsole],
  workspace
);

// in dispose()
features.unregister();
```

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
  origins?: Iterable<string>;
  logger?: HostLogger;
}

interface StandaloneConnection {
  identity: PeerIdentity;
  client: EditorSessionClient;
  openCatalog?: CatalogOpener;
}
```

`dev` enables the hooks meant for development builds; pass
`import.meta.env.DEV`. Once the handle is ready it is exposed as
`window.jollyEditor`, typed as `EditorHandle`, and as `globalThis[debugHandle]`
when `debugHandle` is set. A `username` query parameter is stored as the tab's
identity (see [`rememberQueryUsername`](./EditorSession.md#identity)) so the
prompt is skipped. Without `dev`, neither happens.

`connect` replaces the username prompt and the WebSocket client. The session
destroys the returned client when it is disposed or fails to open.

The session opens while the launch is read when the page URL has a `target`
query parameter: a shell that also posts `jolly-launch` names the same asset,
so the session is ready sooner. When the launch names another target, that
session is disposed and a new one opens, so `connect` runs twice.

`origins` lists the parent origins allowed to launch the page, `[location.origin]`
by default. It applies to the parent's `jolly-launch`, which is read before
`sources`; see [Shell channel](#shell-channel). `logger` replaces the logger read by
`readDebugLogger()`.

## Offline fallback

`bootStandalone` is the entry point of an editor that can also run offline.
It mounts online through `mountStandalone`, and mounts on an in-page
workspace when asked to or when the asset server cannot be reached.

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

```ts
function bootStandalone<THandle extends EditorHandle>(
  definition: EditorDefinition<THandle>,
  options: BootStandaloneOptions
): Promise<THandle>;

interface BootStandaloneOptions
  extends Omit<MountStandaloneOptions, "connect"> {
  offline: OfflineProjectLoader;
  forceOffline?: boolean;
}

interface OfflineProject {
  handlers: AssetKindHandler[];
  seed?: OfflineSeed;
  backend?: AssetBackendTuning;
}
type OfflineSeed =
  | AssetSeedMap
  | (() => AssetSeedMap | Promise<AssetSeedMap>);
type OfflineProjectLoader = () => OfflineProject | Promise<OfflineProject>;
```

| Option | Role |
|---|---|
| `offline` | the handlers, seed and backend tuning of the in-page workspace; called only in the tab that owns the workspace, so import them dynamically |
| `forceOffline` | skips the server; pass `import.meta.env.MODE === "static"` for a static build |
| `sources` | replaces the launch sources read after the parent's, for the online attempt only |

The editor goes offline straight away when `forceOffline` is set or the page
has the `offline` [query parameter](./QueryParams.md#host-parameters).
Otherwise, when the online mount throws `CatalogUnavailableError` or
`LaunchNotFoundError`, `offerOffline` asks the user to retry or to open the
offline workspace, and cancelling rethrows the error. Any other error is
rethrown without asking. The runtime is created once, before the first
attempt, and reused by every retry and by the offline mount, since the canvas
keeps the context of the first one; it is disposed when the boot fails.

Offline, `openSharedTabWorkspace` opens the workspace named by the
`workspace` query parameter (`"default"` without it), and the editor mounts
with the workspace's connection. The launch comes from the parent's
`jolly-launch` first, as online, so a page framed by the studio keeps its
[shell channel](#shell-channel), then from the workspace's launch sources.

`offerOffline(message)` shows the Retry / Open offline workspace dialog alone,
for a page that connects without `mountStandalone`. It resolves `"retry"`,
`"offline"`, or `null` when cancelled.

`withOfflineFallback` runs that same loop for any connection:

```ts
function withOfflineFallback<TValue>(options: {
  message: string;
  online: () => Promise<TValue>;
  offline: () => Promise<TValue>;
}): Promise<TValue>;
```

It retries `online` on Retry and switches to `offline` on Open offline
workspace. Only `CatalogUnavailableError` and `LaunchNotFoundError` show the
dialog; any other error, or cancelling it, is rethrown.

## Offline

`@jolly-pixel/editor.host/offline` runs the asset back-end inside the page. The
editor mounts through the same `mount` as online, with a catalog, rooms and
leases. The tab that owns the workspace stores it in IndexedDB, so asset
content and ids survive a reload. Without Web Locks the workspace lives in
memory and nothing outlives the page.

```ts
import { mountStandalone } from "@jolly-pixel/editor.host";

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

| Member | Role |
|---|---|
| `openSharedTabWorkspace({ project, name? })` | opens the persistent workspace in one tab and connects other tabs to it over BroadcastChannel; resolves a `StandaloneWorkspace` |
| `StandaloneWorkspace` | the members below that every workspace shares: `persistent`, `connect()`, `launchSources()`, `reset()`, `close()` |
| `connect()` | a guest identity, a local or BroadcastChannel client and the workspace |
| `launchSources(accepts)` | a known `?target=`, then the target last opened in this browser, then the first catalog record of the `accepts` kind; a shared follower reads the owner's catalog only when its source is read, and its next `connect()` reuses that catalog unless a connection was already opened |
| `persistent` | whether the assets outlive the page |
| `reset()` | closes the owner workspace and deletes its database; unavailable in a follower tab |
| `close()` | flushes, then stops the server and the back-end; safe to call twice |

Several clients can share one workspace. Destroying one client leaves the others
connected; destroying the last closes the workspace. Once closing starts,
`connect()` refuses new connections.

`name` defaults to `"default"` and selects the `jolly-workspace:<name>`
database. `seed` is a seed map or a function
returning one, used only when the storage holds no asset: a seeded asset the
user deleted does not come back. `backend` takes the
[`AssetBackendTuning`](../../../asset-server/docs/Workspace.md) the Vite
workspace plugin takes, such as `catalogArchiveLimits`; `watch` is always
off.

In IndexedDB:

- Give seeded assets random ids. A fixed id would make the first map of every
  user the same asset, and their archives would collide on import.
- `openSharedTabWorkspace` uses the Web Lock to select one database owner.
  Other tabs use the owner's catalog and asset rooms over BroadcastChannel.
  A tab that finds the lock held never calls `project` and never loads the
  back-end. When Web Locks are unavailable it returns a memory workspace.
- A follower tab queues a request for the owner's lock and reloads when it is
  granted, which happens once the owner closes its workspace or its tab.
  Timer throttling in a hidden owner tab does not make followers reload.
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

The target is read from the first source that answers:

| Order | Source |
|---|---|
| 1 | `{ type: "jolly-launch", target }` posted by the parent frame from an allowed origin in answer to the page's `{ type: "jolly-ready" }`, waited for 1000 ms |
| 2 | the `target` query parameter |
| 3 | the JSON element injected by the asset workspace Vite plugin's `launch` option |

The parent's `jolly-launch` is always read first, so a page framed by a shell
keeps its [shell channel](#shell-channel). `sources` replaces the rest of the
list. A source returns `undefined` to pass to the next one:

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
`jolly-launch`. The ready message is posted once per allowed origin, so a
parent on another origin never receives it, and a `jolly-launch` from an
origin outside the list is ignored:

```ts
new HostMessageLaunchSource({
  timeout?: number;
  origins?: Iterable<string>;
  logger?: HostLogger;
});
```

| Option | Default | Role |
|---|---|---|
| `timeout` | `1000` | milliseconds to wait for `jolly-launch` |
| `origins` | `[location.origin]` | parent origins allowed to launch the page; `ANY_SHELL_ORIGIN` (`"*"`) allows every origin |
| `logger` | none | receives `ready posted`, `launch accepted`, `launch rejected` and `launch timed out` |

A launch that came this way carries a `ShellChannel` bound to the parent and
to the origin of its answer. The channel posts commands back and receives
the shell's [appearance](#appearance), never a reply to a command:

```ts
class ShellChannel {
  readonly origin: string;
  readonly appearance: Appearance | null;
  readonly catalog: ShellCatalog | null;
  readonly console: MessagePort | null;
  openAsset(id: AssetId | string): void;
  toggleConsole(): void;
  onAppearance(
    listener: (appearance: Appearance) => void,
    signal: AbortSignal
  ): void;
}
```

| Command | Message |
|---|---|
| `openAsset(id)` | `{ type: "jolly-shell", command: "open-asset", target: id }` |
| `toggleConsole()` | `{ type: "jolly-shell", command: "toggle-console" }` |

A shell that listens on its own window narrows what a frame posts with
`isReadyMessage(data)` and `isShellCommand(data)`, and answers with
`launchMessage(target, appearance, ports?)`. `parseLaunchMessage(data)` is the
frame's side: it returns the launch message, without an invalid `appearance`
and with `ports` reset to `{}` when they are not ports, or `undefined`.
`READY_MESSAGE_TYPE`, `LAUNCH_MESSAGE_TYPE`, `SHELL_MESSAGE_TYPE` and
`APPEARANCE_MESSAGE_TYPE` name the four messages.

### Shell catalog

A shell can send a `MessagePort` as `ports.catalog` of `jolly-launch`, listed
in the transfer list too. The channel then has a `ShellCatalog` as `catalog`,
and the session opens its `CatalogClient` there instead of joining the
catalog room on its own client. `ShellCatalog` is a
`CatalogRoomSource`, so `CatalogClient.connect(catalog, options?)` opens one;
each gets its own port, sent with `{ type: "jolly-catalog-open" }` on the
launch port. Without a port, `catalog` is `null` and the session opens its
catalog as before.

The shell opens its own catalog with `CatalogShare.open(client, options?)`,
which takes the same `CatalogConnectOptions` as `CatalogClient.connect`,
destroys `client` on failure and exposes the opened catalog as
`share.catalog`. It then serves each launch port:

```ts
const share = await CatalogShare.open(client, { timeoutMs: 5_000 });
const channel = new MessageChannel();
const stop = share.serve(channel.port1);
frame.contentWindow.postMessage(
  launchMessage(target, appearance, { catalog: channel.port2 }),
  origin,
  [channel.port2]
);
```

Each port gets a snapshot of the shell's catalog, then every message of its
room. A command a frame sends goes out on that room, and its reply goes back
to the port that sent it. `stop()` closes the launch port and every port
opened through it; `share.dispose()` stops relaying for every frame and
disposes `share.catalog`.

### Shell console

A shell can also send a port as `ports.console`. The channel exposes it as
`console`, `null` without one, and the page serves its `CommandConsole` on
it with a [`ConsoleServer`](../../../console/docs/remote.md). Only the
namespaces cross; root registrations stay on the page.

Both ports travel in the message itself, so each keeps its name:

```ts
const catalog = new MessageChannel();
const consolePorts = new MessageChannel();
const stopCatalog = share.serve(catalog.port1);
const stopConsole = consoles.connect(frameId, consolePorts.port1);
const ports: LaunchPorts = {
  catalog: catalog.port2,
  console: consolePorts.port2
};
frame.contentWindow.postMessage(
  launchMessage(target, appearance, ports),
  origin,
  [catalog.port2, consolePorts.port2]
);
```

`FrameConsoles` is the shell's side. It mirrors each frame's console on the
shell console with a `ConsoleMirror`, and only the focused frame's is active:

```ts
class FrameConsoles {
  constructor(options: {
    commands: CommandConsole;
    logger?: HostLogger;
  });
  connect(id: string, port: MessagePort): () => void;
  focus(id: string | null): void;
}
```

`focus(id)` removes the previous frame's namespaces and shows those of `id`,
as soon as it connects if it has not yet; `null` shows none.
`connect` replaces the port of an id already connected, which is how a
reloaded frame takes over, and the returned function closes the mirror. A
frame namespace whose name the shell console already uses stays hidden, and
`logger` (default `readDebugLogger()`, namespace `host.console`) warns
`editor namespace hidden by the shell` with the frame id and the namespace.

A launch read from the query string or the injected element has no channel,
so `context.shell` is `null` and an editor hides what only a shell can do.

## Appearance

A shell keeps its frames on its own theme and density. It adds
`appearance` to `jolly-launch`, then posts every later change, built with
`launchMessage` and `appearanceMessage(appearance)`:

```ts
{ type: "jolly-launch", target: string, appearance?: Appearance, ports: LaunchPorts }
{ type: "jolly-appearance", appearance: Appearance }

interface Appearance {
  theme: ThemeMode;
  density: Density;
}

interface LaunchPorts {
  catalog?: MessagePort;
  console?: MessagePort;
}
```

The channel keeps the launch appearance as `shell.appearance`, `null` when
missing or invalid. `shell.onAppearance(listener, signal)` calls `listener`
with each valid `jolly-appearance` posted by the parent from the channel's
origin, until `signal` aborts. A page launched with a shell channel applies
the launch appearance before `mount`, then each one it receives. `auto`
removes the `theme` attribute.

`PageAppearance` reads and writes the `jolly-scope` elements of a root,
`document` by default:

```ts
class PageAppearance implements Appearance {
  constructor(root?: ParentNode);
  theme: ThemeMode;
  density: Density;
  apply(appearance: Appearance): void;
  watch(
    listener: (appearance: Appearance) => void,
    signal: AbortSignal
  ): void;
  toJSON(): Appearance;
}
```

The getters read the first scope, `auto` and `default` when it sets nothing.
The setters write every scope and throw when the root has none. `apply`
writes both values to every scope and does nothing on a root without one.
`watch` calls `listener` with the current appearance after a `theme` or
`density` attribute of any scope under the root changes, scopes added later
included, until `signal` aborts. `THEME_MODES` and `DENSITIES` from
`@jolly-pixel/ui` list the accepted values.

## Boot tracing

`mountStandalone` logs each boot step to a `HostLogger`, the engine's
[`Systems.Logger`](../../../engine/docs/systems/logger.md), as a `step`.
Nothing is logged unless the page enables it:

| Switch | Example |
|---|---|
| `?debug=` query parameter | `?debug=host.*,editor.*`; a bare `?debug` enables every namespace |
| `jolly-pixel:debug` in `localStorage` | `localStorage.setItem("jolly-pixel:debug", "*")`, for pages framed by the studio |

The query parameter wins over the stored value. Namespaces are comma-separated
globs:

| Namespace | Logs |
|---|---|
| `host.boot` | `state <state>`, `<step> started` and `<step> done` with `ms` for the `launch`, `session`, `mount` and `ready` steps, `launch source read` per source, `<step> failed` with the error, or `boot failed` for an error outside the steps |
| `host.launch` | the handshake of the default `HostMessageLaunchSource` |
| `host.session` | the [session steps](./EditorSession.md#boot-steps) |
| `editor` | `context.logger` and the children an editor derives from it; voxel-map and voxel-model write a `scene` step while their scene awakes |
| `editor.runtime` | the [startup steps](../../../runtime/docs/api/Runtime.md#startup-tracing) of the editor's `Runtime`, when `createRuntime` passes its `logger` to `EditorRuntime.create` |
| `studio.tabs` | the studio side of the handshake |

```ts
function readDebugLogger(options?: {
  search?: string;
  storage?: Pick<Storage, "getItem"> | null;
}): HostLogger;
```

`search` defaults to `location.search` and `storage` to `localStorage`. A
storage that throws enables nothing. `DEBUG_QUERY_PARAM` and
`DEBUG_STORAGE_KEY` name both switches. `EditorLaunch.read(sources, logger?)`
logs each source it reads.

## Errors

| Error | From | Thrown when |
|---|---|---|
| `LaunchNotFoundError` | this package | no source answers |
| `CatalogUnavailableError` | `@jolly-pixel/asset-server/client` | the catalog does not answer before the connection timeout |
| `AssetNotFoundError` | `@jolly-pixel/asset` | the catalog has no record for the target |
| `AssetKindMismatchError` | `@jolly-pixel/asset` | the target's kind is not `accepts` |

An error thrown by `mount` is rethrown after the session is disposed.
