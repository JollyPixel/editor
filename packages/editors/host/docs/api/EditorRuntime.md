# EditorRuntime

`EditorRuntime` boots a `Runtime` for an editor view and owns its keyboard
policy.

## API

```ts
class EditorRuntime {
  static create(
    canvas: RuntimeCanvasTarget,
    options?: RuntimeOptions
  ): Promise<EditorRuntime>;

  readonly runtime: Runtime;

  constructor(runtime: Runtime);

  load(
    scene: Systems.Scene,
    options?: { maxFps?: number; }
  ): Promise<void>;
  suspendKeyboardOnHover(target: EventTarget, event: string): () => void;
}
```

`create` guards the runtime keyboard with `inputLayers`, so open dialogs and
popovers keep their keys. The constructor wraps a runtime without adding the
guard.

`load` loads the scene without a loading screen. It does not wait for the
scene's own readiness; await that after `load`.

`suspendKeyboardOnHover` disables the keyboard while `event` reports
`{ hovering: true }` in its `detail`, such as the pixel-draw panel's
`canvas-hover-change`. The returned function removes the listener.
