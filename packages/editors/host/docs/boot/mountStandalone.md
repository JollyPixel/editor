# mountStandalone

Boots an editor class in a page: reads the [launch](../launch/EditorLaunch.md), opens
the [session](../session/EditorSession.md), then calls the class's `mount`. See the
[architecture guide](../../ARCHITECTURE.md#boot) for the sequence.

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
    this.#scene.dispose();
  }
}

await mountStandalone(VoxelModelEditor, { dev: import.meta.env.DEV });
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
  readonly archive?: EditorArchiveLabels;
  mount(context: EditorContext): Promise<THandle>;
}

interface RuntimeEditorDefinition<THandle extends EditorHandle> {
  readonly accepts: string;
  readonly identity: { title: string; };
  readonly kinds: Iterable<AssetDocumentKind<unknown>>;
  readonly archive?: EditorArchiveLabels;
  createRuntime(logger: HostLogger): Promise<EditorRuntime>;
  mount(context: RuntimeEditorContext): Promise<THandle>;
}
```

### accepts

The asset kind of the target. A target of any other kind is refused.

### identity.title

Title of the username prompt.

### kinds

The [document kinds](../lease/AssetLeases.md#document-kinds) of the dependencies the
session leases.

### archive

Optional `fallbackName` and `resetWarning` of the
[archives](../session/Archives.md#editorarchives) the host builds for each mount.

### createRuntime(logger)

Optional. Called as soon as the boot starts, so the renderer starts while the
session connects. The [`EditorRuntime`](../runtime/EditorRuntime.md) is created once
per page and reused by every [switch](#switching-target-or-tag). `logger` is
the `editor.runtime` namespace of the [boot trace](#boot-tracing).

### mount(context)

Builds the editor from a connected session and returns its handle.

## Editor context

```ts
interface EditorContext {
  launch: EditorLaunch;
  session: EditorSession;
  toolbar: EditorToolbarSources;
  shell: ShellChannel | null;
  logger: HostLogger;
  commands: CommandConsole;
  lantern: Lantern;
  preferences: Preferences;
  keyboardLayout: KeyboardLayoutStore;
  archives: EditorArchives;
}

interface RuntimeEditorContext extends EditorContext {
  runtime: EditorRuntime;
}
```

- `launch` is the [launch](../launch/EditorLaunch.md) being mounted.
- `toolbar` holds the [toolbar sources](../session/EditorToolbar.md#editortoolbarsources)
  this launch allows.
- `shell` is the [shell channel](../shell/ShellChannel.md), `null` when no parent
  frame launched the page.
- `logger` is the `editor` namespace of the [boot trace](#boot-tracing).
- `commands` is the page's [console](#console).
- `lantern` holds the page's [guided tours](#tours). Which tours were
  finished is the `lantern` [preference scope](../preferences/Preferences.md#host-scopes).
- `preferences` holds the user's [preferences](../preferences/Preferences.md).
  Under a shell they come from the launch and follow the shell's pushes, and a
  change goes back as an `update-preferences` command. Otherwise they are a
  `LocalPreferences`. Each mount gets a [view](../preferences/Preferences.md#view)
  that closes when the editor is disposed, so every watch made through it
  stops on a switch. Before `mount`, the runtime widgets follow them.
- `keyboardLayout` is the page's `KeyboardLayoutStore`, refreshed when the
  window gets the focus. Label shortcuts with it so they show the characters
  the user's keyboard prints; the `camera` keys of tour bodies use it too.
- `archives` exports, imports and resets the target's
  [archives](../session/Archives.md#editorarchives).

## Editor handle

```ts
interface EditorHandle {
  readonly ready: Promise<void>;
  readonly session: EditorSession;
  readonly runtime: Runtime | null;
  dispose(): void;
}
```

`ready` resolves once the target document is loaded and the scene has awoken.
`mountStandalone` waits for it and disposes the handle when it rejects.
`runtime` is `null` for an editor without a 3D view.

`dispose()` releases only what `mount` built: leases, panel bindings, console
registrations and listeners. It must not dispose `context.session` or the
runtime, which a switch reuses. Leases from
[`session.targetLease()`](../session/EditorSession.md#targetleasekind) and
[`session.lease()`](../session/EditorSession.md#leasekind-assetid) belong to
the session.

## Options

```ts
function mountStandalone<THandle extends EditorHandle>(
  definition: EditorDefinition<THandle>,
  options?: MountStandaloneOptions
): Promise<StandaloneMount<THandle>>;

interface MountStandaloneOptions {
  sources?: Iterable<LaunchSource>;
  dev?: boolean;
  debugHandle?: string;
  connect?: () => StandaloneConnection | Promise<StandaloneConnection>;
  origins?: Iterable<string>;
  logger?: HostLogger;
}
```

### sources

The [launch sources](../launch/EditorLaunch.md#launch-sources) read after the parent's
`jolly-launch`.

### dev

Pass `import.meta.env.DEV`. Exposes the ready handle as `window.jollyEditor`
(`DEBUG_HANDLE`), and as `globalThis[debugHandle]` when `debugHandle` is set.
Stores the `username` query parameter so the prompt is skipped (see
[`rememberQueryUsername`](../session/EditorSession.md#identity)).

### connect

Replaces the username prompt and the WebSocket client, for example with an
[offline mode](./bootStandalone.md#offline-mode). The session
destroys the returned client when it is disposed or fails to open. With a
`?target=` in the URL, the session opens while the launch is read, so
`connect` runs twice when the parent's launch names another target.

### origins

Parent origins allowed to launch the page, `[location.origin]` by default.

### logger

Replaces `readDebugLogger()`.

## StandaloneMount

```ts
interface StandaloneMount<THandle extends EditorHandle> extends LaunchNavigator {
  readonly handle: THandle;
  navigate(target: string, tag: string | null): Promise<void>;
  dispose(): void;
}
```

`handle` is the handle mounted now and changes on every switch; the dev
handle follows it. `dispose()` disposes the handle, the session and its
connection, the console and the runtime.
[`bootStandalone`](./bootStandalone.md) resolves with the same object.

## Switching target or tag

`navigate(target, tag)` opens another asset or version without reloading the
page. The [editor toolbar](../session/EditorToolbar.md) calls it.

1. Waits until the server has acknowledged every pending change. After 10
   seconds it rejects with `UnsettledChangesError` and keeps the editor.
2. Opens a session for the new launch on the same
   [connection](../session/EditorSession.md#connection), so dependencies both targets
   use stay joined.
3. Disposes the handle, then the toolbar, preferences view and console
   registrations the host made for it, and calls `mount` again with the new
   `launch`, `session` and `toolbar`. The scene replaces the old one in the same
   runtime through [`EditorRuntime.load`](../runtime/EditorRuntime.md#loading-a-scene).
4. Updates `?target=` and `?tag=`, pushing a history entry outside a shell
   and replacing it inside one. Back and forward navigate the same way.

A request made during a switch waits, and only the latest waiting one runs. A
target that cannot be opened rejects and leaves the current editor running.
A failure after the old editor is gone reloads the page on the new URL.
Editor state that `mount` creates, such as the brush, starts over.

## Page lifecycle

`mountStandalone` sets `data-editor-state` (`EDITOR_STATE_ATTRIBUTE`) on
`document.documentElement`, in every build:

- `booting` until the first editor is ready.
- `ready` once `handle.ready` resolves. For an editor with a runtime on a
  visible page, it also waits for
  [`runtime.compiledFrame()`](../../../../runtime/docs/api/Runtime.md#methods),
  so the first frame shown has every pipeline compiled.
- `switching` while a switch runs.
- `failed` when a boot step throws, or a switch fails after the old editor is
  disposed.

```ts
await page.waitForFunction(
  () => document.documentElement.dataset.editorState === "ready"
);
```

While `booting` or `switching` lasts more than 200 ms, a thin progress bar
runs along the top of the page. During `switching` the page also ignores
pointer input and shows a `progress` cursor, so the old editor cannot be
edited while it is being replaced. Inside a shell, every state is also
[reported to the shell](../shell/ShellChannel.md#reportstatestate).

While [`session.assets`](../lease/AssetLeases.md#unsaved-changes) has unsaved
changes, the page reports them to the shell, or cancels `beforeunload`
without one so the browser asks before leaving.

On a `pagehide` with `persisted`, the page disposes the handle, the session
and the runtime, so a page kept in the back/forward cache leaves its rooms. A
page restored from that cache reloads.

## Console

`mountStandalone` creates one `CommandConsole` per page and passes it as
`context.commands`. An editor registers its
[console features](../../../../console/docs/features.md) there and unregisters
them in `dispose()`:

```ts
const features = registerConsoleFeatures(context.commands, [brushConsole], editing);

// in dispose()
features.unregister();
```

For every mount, the host registers the [`archive`](../session/Archives.md#console)
namespace, the [`peer`](./bootStandalone.md#console) one in the owner tab of
persistent offline data, and the [`runtime`](../runtime/EditorRuntime.md#console)
one for an editor with `createRuntime`.

Without a shell, the page appends a `jolly-console` element and Ctrl+K opens
it. With a shell, Ctrl+K toggles the shell's console, which shows the page's
namespaces when the launch carries a [console port](../shell/ShellChannel.md#console-port).

The console registers two root variables, `theme` (`light`, `dark`, `auto`)
and `density` (`compact`, `default`, `comfortable`). They write every
`jolly-scope` of the page and persist under `jolly-pixel:theme` and
`jolly-pixel:density`, except under a shell, whose appearance wins. In the
studio, they are the account's preferences.

## Tours

`mountStandalone` creates one [`Lantern`](../../../../lantern/docs/Lantern.md)
per page, appends a `jolly-lantern` element to the first `jolly-scope` and
passes the lantern as `context.lantern`. An editor registers its tours in
`mount` and releases them in `dispose()`:

```ts
const release = context.lantern.register(basics);

// in dispose()
release();
```

To start a tour for people who have never seen it, call
`context.lantern.offer(basics)` once the editor is ready. The host turns offers
off when `navigator.webdriver` is set, so e2e runs never see a tour they did
not start.

The page registers a `tour` console namespace: `/tour.list`, `/tour.start <id>`
and `/tour.reset [id]`. Warnings about missing targets go to the
`host.lantern` logger.

`REPLAY_TOUR_STEP` is a step for the end of a tour. It points at the toolbar's
Tours button and tells the user they can replay the tour from there. The host
owns its target, so an editor tour lists it as is:

```ts
import { REPLAY_TOUR_STEP } from "@jolly-pixel/editor.host";

const basics = new Tour({
  id: "voxel-map.basics",
  version: 1,
  title: "Voxel map basics",
  steps: [welcome, blocks, REPLAY_TOUR_STEP]
});
```

A page that boots without `mountStandalone`, such as the studio shell, mounts
the same console itself:

```ts
function mountConsole(options?: {
  parent?: HTMLElement;
  storage?: StorageAdapter;
  appearance?: Appearance;
}): EditorConsole;

interface EditorConsole {
  readonly commands: CommandConsole;
  readonly element: HTMLElementTagNameMap["jolly-console"];
  dispose(): void;
}
```

The `theme` and `density` console variables read and write `appearance`.
Without it, the console restores them from `storage` and stores them there,
under `jolly-pixel:theme` and `jolly-pixel:density`. The studio passes its own,
backed by the account's preferences.

## Boot tracing

Each boot step is logged to a `HostLogger`, the engine's
[`Systems.Logger`](../../../../engine/docs/systems/logger.md). Nothing is logged
unless the page enables namespaces, as comma-separated globs:

- `?debug=host.*,editor.*` in the URL; a bare `?debug` enables everything.
- `localStorage.setItem("jolly-pixel:debug", "*")`, for pages framed by the
  studio. The query parameter wins.

Namespaces:

- `host.boot`: state changes and the `launch`, `session`, `mount`, `ready`
  and `compile` steps with their duration.
- `host.launch`: the [parent handshake](../launch/EditorLaunch.md#hostmessagelaunchsource).
- `host.session`: the [session steps](../session/EditorSession.md#boot-steps).
- `host.switch`: the steps of a switch.
- `host.console`: the [frame consoles](../shell/ShellChannel.md#console-port).
- `editor`: `context.logger` and its children.
- `editor.runtime`: the [runtime startup](../../../../runtime/docs/api/Runtime.md#startup-tracing),
  when `createRuntime` passes `logger` to `EditorRuntime.create`.

`readDebugLogger({ search?, storage? })` builds that logger from
`location.search` and `localStorage`.

## Errors

### LaunchNotFoundError

No launch source answers.

### CatalogUnavailableError

From `@jolly-pixel/asset-server/client`. The catalog does not answer before
the connection timeout.

### AssetNotFoundError and AssetKindMismatchError

From `@jolly-pixel/asset`. The catalog has no record for the target, or its
kind is not `accepts`.

An error thrown by `mount` is rethrown after the session is disposed.
