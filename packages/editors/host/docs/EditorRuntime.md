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
  options?: RuntimeOptions & { params?: HostParams; }
): Promise<EditorRuntime>;
```

Takes the arguments of `Runtime.create`. `params` defaults to
[`HOST_PARAMS.read()`](./QueryParams.md#host-parameters). Open dialogs and popovers keep their
keys: the runtime keyboard ignores them until the layer closes.

## Properties

```ts
readonly runtime: Runtime;
readonly params: HostParams;
get samples(): number | undefined;
```

`samples` is the `samples` query parameter, for an editor that sets up its own
multisampled render targets.

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

Disables the runtime keyboard while the pointer is over a panel that has its
own shortcuts. `event` is a `CustomEvent` whose `detail` is
`{ hovering: boolean }`, such as the pixel-draw panel's `canvas-hover-change`.
The returned function removes the listener and releases that binding's
suspension, including when called during hover. Repeated calls do nothing.
Overlapping bindings keep input disabled until the last hovering binding
releases it, then restore the state from before the first suspension. Input
that was already disabled stays disabled.
