# EditorDefinition

The class an editor passes to [`bootStandalone`](./bootStandalone.md). Its
statics describe the editor, and `mount` builds it from a connected session.

```ts
class VoxelModelEditor {
  static readonly accepts = VOXEL_MODEL_KIND;
  static readonly identity = { title: "Join voxel model" };
  static readonly kinds = [TEXTURE_DOCUMENT_KIND];

  static createRuntime(logger: HostLogger): Promise<EditorRuntime> {
    return EditorRuntime.create("#canvas", { logger });
  }

  static async mount(context: RuntimeEditorContext): Promise<VoxelModelEditor> {
    // ...
  }

  readonly ready: Promise<void>;
  readonly session: EditorSession;
  readonly runtime: Runtime;

  dispose(): void {
    this.#teardown.run();
  }
}
```

## Definition

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

interface RuntimeEditorDefinition<THandle extends EditorHandle>
  extends Omit<PageEditorDefinition<THandle>, "mount"> {
  createRuntime(logger: HostLogger): Promise<EditorRuntime>;
  mount(context: RuntimeEditorContext): Promise<THandle>;
}
```

- `accepts` is the asset kind of the target. A target of another kind is
  refused.
- `identity.title` titles the username prompt.
- `kinds` lists the [document kinds](../lease/AssetLeases.md#document-kinds)
  the editor leases. Reuse the same kind objects everywhere.
- `archive` names the downloads of [`context.archives`](../session/Archives.md).
- `createRuntime` is optional. The host calls it before the session opens, so
  the renderer starts while the page connects, and reuses the
  [`EditorRuntime`](../runtime/EditorRuntime.md) on every switch. `mount`
  then receives a `RuntimeEditorContext`.

## Context

```ts
interface EditorContext {
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

- `session` is the [session](../session/EditorSession.md) on the target.
- `toolbar` goes to the [editor toolbar](../ui/EditorToolbar.md).
- `shell` is `null` unless a [shell](../shell/Shell.md) framed the page.
  Hide what only a shell can do when it is `null`.
- `logger` is the `editor` namespace of the
  [debug logger](./bootStandalone.md#debug-logging).
- `commands` is the page [console](#console).
- `lantern` holds the page [tours](#tours).
- `preferences` holds the user's [preferences](../preferences/Preferences.md).
  Every watch made through it stops when the editor is disposed.
- `keyboardLayout` labels shortcuts with the characters the user's keyboard
  prints.
- `archives` holds the export and import flows of the
  [archives](../session/Archives.md).

## Handle

```ts
interface EditorHandle {
  readonly ready: Promise<void>;
  readonly session: EditorSession;
  readonly runtime: Runtime | null;
  dispose(): void;
}
```

- `ready` resolves once the target is loaded and the scene has awoken. The
  host disposes the handle when it rejects.
- `runtime` is `null` for an editor without a 3D view.
- `dispose()` releases only what `mount` built: leases it opened, bindings,
  console registrations and listeners. It must not dispose `context.session`
  or the runtime, which the host owns and a switch reuses.

### Teardown

`new Teardown()` collects release steps. `defer(step)` adds one; `run()`
aborts `signal`, then runs the steps once, last added first. A `mount` that
throws halfway calls `run()` to release what it built so far.

## Console

`context.commands` is one `CommandConsole` per page, opened with Ctrl+K. An
editor registers its features in `mount` and unregisters them in `dispose()`:

```ts
const features = registerConsoleFeatures(context.commands, [brushConsole], editing);

// in dispose()
features.unregister();
```

The host already registers these namespaces, so an editor must not reuse them:

- `archive`: `/archive.export`, `/archive.import` and `/archive.reset`.
- `runtime`: `stats`, `viewHelper` and `metrics`, for an editor with
  `createRuntime`.
- `tour`: `/tour.list`, `/tour.start <id>` and `/tour.reset [id]`.
- `peer`: `/peer.invite` and `/peer.stop`, in the tab that owns persistent
  offline data.
- The root variables `theme` and `density`.

## Tours

`context.lantern` is one `Lantern` per page. Register tours in `mount` and
release them in `dispose()`. `offer(tour)` starts a tour for users who never
saw it; offers are off while `navigator.webdriver` is set.

```ts
const release = context.lantern.register(basics);
context.lantern.offer(basics);

// in dispose()
release();
```

`REPLAY_TOUR_STEP` is a closing step that points at the toolbar's Tours
button:

```ts
const basics = new Tour({
  id: "voxel-map.basics",
  version: 1,
  title: "Voxel map basics",
  steps: [welcome, blocks, REPLAY_TOUR_STEP]
});
```

## Errors

An error thrown by `mount` is rethrown after the session is disposed.
