# EditorRuntime

Boots a `Runtime` from `@jolly-pixel/runtime` for an editor's 3D view, with the
keyboard rules an editor needs next to UI panels. An editor creates it in its
definition's `createRuntime`.

```ts
static createRuntime(logger: HostLogger): Promise<EditorRuntime> {
  return EditorRuntime.create("#canvas", { logger });
}

// in mount()
await context.runtime.load(scene, { maxFps: Infinity });
```

## Properties

```ts
readonly runtime: Runtime;
get samples(): number | undefined;
```

`samples` is the `?samples=` [query parameter](../params/QueryParams.md#host-parameters),
for an editor that builds its own multisampled render targets.

## Methods

### static create(canvas, options?): Promise<EditorRuntime>

Takes the arguments of `Runtime.create`.

- In a frame, such as a studio tab, the view renders on demand: after input,
  `world.invalidate()`, and while a `world.keepAlive()` predicate holds. A
  component that changes the scene from room traffic must invalidate the
  world itself.
- A standalone page renders continuously, so the performance overlay reports
  a real frame rate. `?render=continuous` or `?render=on-demand` overrides
  both.
- A hidden studio tab stops rendering until its canvas shows again.
- Open dialogs and popovers keep their keys: the runtime keyboard ignores them
  until the layer closes.

### load(scene, options?): Promise<void>

Loads the scene without a loading screen. `?max-fps=` wins over
`options.maxFps`; without either, the runtime picks a cap from the GPU tier.

- `load` resolves before the scene awakes, so a scene with async setup needs
  its own readiness promise.
- After a switch the runtime is already running: `load` replaces the scene,
  and `options` are ignored.

### suspendKeyboardOnHover(target, event): () => void

Suspends the runtime keyboard while the pointer is over a panel that has its
own shortcuts. `event` is a `CustomEvent` whose `detail` is
`{ hovering: boolean }`, such as the pixel-draw panel's `canvas-hover-change`.

```ts
const resume = editorRuntime.suspendKeyboardOnHover(
  texturePanel,
  "canvas-hover-change"
);
```

The returned function removes the listener and lifts the suspension, even
during a hover. Held keys are released when the suspension starts.
