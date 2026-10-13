# EditorRuntime

Boots a `Runtime` from `@jolly-pixel/runtime` for an editor's 3D view, with the
keyboard rules an editor needs next to UI panels.

```ts
const editorRuntime = await EditorRuntime.create("#canvas");
await editorRuntime.load(scene, { maxFps: Infinity });
await scene.ready;

const stop = editorRuntime.suspendKeyboardOnHover(
  texturePanel,
  "canvas-hover-change"
);
```

## Creation

```ts
static create(
  canvas: RuntimeCanvasTarget,
  options?: RuntimeOptions & {
    params?: HostParams;
    framed?: boolean;
    storage?: StorageAdapter;
  }
): Promise<EditorRuntime>;
```

Takes the arguments of `Runtime.create`. `params` defaults to
[`HOST_PARAMS.read()`](../params/QueryParams.md#host-parameters). Open dialogs and popovers keep their
keys: the runtime keyboard ignores them until the layer closes.
`suspendWhenHidden` defaults to `true`, so an editor in a hidden studio tab
stops rendering until its canvas shows again.

In a frame, such as a studio tab, the view renders on demand: it renders after
input, `world.invalidate()` and while a `world.keepAlive()` predicate holds,
then idles. See
[rendering on demand](../../../../runtime/docs/api/Runtime.md#rendering-on-demand).
Components that change the scene from room traffic, such as
[`PeerFrustums`](./PeerFrustums.md), invalidate the world themselves. An
editor whose scene changes without telling the world passes
`renderOnDemand: false`.

A standalone page renders continuously, so the performance overlay reports a
real frame rate. `framed` defaults to `window.parent !== window`. The `render`
[query parameter](../params/QueryParams.md#host-parameters) overrides it for any
editor: `render=continuous` rules out a missed wake-up in the studio, and
`render=on-demand` brings idling back to a standalone page.

`storage` keeps the [widget visibility](#runtime-widgets) between page loads.
It defaults to a `LocalStorageAdapter`; `create` restores the stored
visibility of the performance HUD and the view helper once the runtime exists.

An editor booted by [`mountStandalone`](../editor/mountStandalone.md#editor-definition)
creates it in its static `createRuntime(logger)`, which the host calls before
the session opens.

## Properties

```ts
readonly runtime: Runtime;
readonly params: HostParams;
readonly widgets: RuntimeWidgets;
get samples(): number | undefined;
dispose(): void;
```

`samples` is the `samples` query parameter, for an editor that sets up its own
multisampled render targets. `dispose()` disposes `runtime`.

## Runtime widgets

`widgets` shows or hides the corner performance HUD (`"stats"`), the axis
gizmo (`"viewHelper"`) and the metrics panel (`"metrics"`), and saves every
change under `jolly-pixel:runtime-widgets`.

```ts
mounted(widget: RuntimeWidget): boolean;
visible(widget: RuntimeWidget): boolean;
show(widget: RuntimeWidget, visible: boolean): void;
startsHidden(widget: RuntimeWidget, fallback: boolean): boolean;
restore(): void;
```

`mounted` is `false` while the runtime has no such widget, for example before
`runtime.mountMetricsPanel` resolves. `show` throws on a widget that is not
mounted.

`startsHidden` is the saved visibility of a widget, or `fallback` when it was
never toggled. Pass it as the `hidden` option of the metrics panel so the pane
opens the way it was left:

```ts
await editorRuntime.runtime.mountMetricsPanel({
  hidden: editorRuntime.widgets.startsHidden("metrics", true)
});
```

`restore` applies the saved visibility to the mounted widgets and leaves the
others alone.

## Loading a scene

```ts
load(
  scene: Systems.Scene,
  options?: { maxFps?: number; }
): Promise<void>;
```

Loads the scene without a loading screen. The `max-fps` query parameter wins
over `options.maxFps`, which is the editor's own cap; without either the
runtime picks one from the GPU tier. `load` resolves before the scene
awakes, so a scene with async setup needs its own readiness promise.

On a runtime that is already running, as after an editor
[switch](../editor/mountStandalone.md#switching-target-or-tag), `load` replaces the
current scene instead: the old scene is destroyed on the next frame, and
`load` resolves after that frame. `options` are ignored then; the cap set by
the first `load` stays.

## Keyboard

```ts
suspendKeyboardOnHover(target: EventTarget, event: string): () => void;
```

Suspends the runtime keyboard while the pointer is over a panel that has its
own shortcuts. `event` is a `CustomEvent` whose `detail` is
`{ hovering: boolean }`, such as the pixel-draw panel's `canvas-hover-change`.
The returned function removes the listener and releases that binding's
suspension, including when called during hover. Repeated calls do nothing.
Overlapping bindings keep input suspended until the last hovering binding
releases it. The suspension uses `Keyboard.suspend()`, so it never changes
`keyboard.enabled`.

## Console

`runtimeConsole` is a [console feature](../../../../console/docs/features.md)
that registers the `runtime` namespace over the
[runtime widgets](#runtime-widgets), so every write is kept after a reload:

- `runtime.stats` shows or hides the corner performance HUD. It is registered
  only when the HUD is mounted.
- `runtime.viewHelper` shows or hides the axis gizmo. It is registered only
  when the gizmo is mounted.
- `runtime.metrics` shows or hides the panel from `mountMetricsPanel()`.
  Writing it before a panel is mounted prints an error.

```ts
import { registerConsoleFeatures } from "@jolly-pixel/console";
import { runtimeConsole } from "@jolly-pixel/editor.host";

registerConsoleFeatures(commands, [runtimeConsole], {
  runtime: editorRuntime
});
```
