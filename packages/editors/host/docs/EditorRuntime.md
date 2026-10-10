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
  }
): Promise<EditorRuntime>;
```

Takes the arguments of `Runtime.create`. `params` defaults to
[`HOST_PARAMS.read()`](./QueryParams.md#host-parameters). Open dialogs and popovers keep their
keys: the runtime keyboard ignores them until the layer closes.
`suspendWhenHidden` defaults to `true`, so an editor in a hidden studio tab
stops rendering until its canvas shows again.

In a frame, such as a studio tab, the view renders on demand: it renders after
input, `world.invalidate()` and while a `world.keepAlive()` predicate holds,
then idles. See
[rendering on demand](../../../runtime/docs/api/Runtime.md#rendering-on-demand).
Components that change the scene from room traffic, such as
[`PeerFrustums`](./PeerFrustums.md), invalidate the world themselves. An
editor whose scene changes without telling the world passes
`renderOnDemand: false`.

A standalone page renders continuously, so the performance overlay reports a
real frame rate. `framed` defaults to `window.parent !== window`. The `render`
[query parameter](./QueryParams.md#host-parameters) overrides it for any
editor: `render=continuous` rules out a missed wake-up in the studio, and
`render=on-demand` brings idling back to a standalone page.

An editor booted by [`mountStandalone`](./mountStandalone.md#editor-definition)
creates it in its static `createRuntime(logger)`, which the host calls before
the session opens.

## Properties

```ts
readonly runtime: Runtime;
readonly params: HostParams;
get samples(): number | undefined;
dispose(): void;
```

`samples` is the `samples` query parameter, for an editor that sets up its own
multisampled render targets. `dispose()` disposes `runtime`.

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

`runtimeConsole` is a [console feature](../../../console/docs/features.md)
that registers the `runtime` namespace over a `Runtime`:

- `runtime.stats` shows or hides the corner performance HUD. It is registered
  only when `runtime.statsHud` is not `null`.
- `runtime.viewHelper` shows or hides the axis gizmo. It is registered only
  when `runtime.viewHelper` is not `null`.
- `runtime.metrics` shows or hides the panel from `mountMetricsPanel()`.
  Writing it before a panel is mounted prints an error.

```ts
import { registerConsoleFeatures } from "@jolly-pixel/console";
import { runtimeConsole } from "@jolly-pixel/editor.host";

registerConsoleFeatures(commands, [runtimeConsole], {
  runtime: editorRuntime.runtime
});
```
