# loadRuntime

`loadRuntime()` configures the device, prepares startup assets and an optional
initial scene, then starts the runtime.

## API

```ts
interface LoadRuntimeOptions<
  TContext = Systems.WorldDefaultContext
> {
  loadingDelay?: number;
  loadingContainer?: HTMLElement;
  assets?: Iterable<AssetReference<unknown>>;
  scene?: Systems.Scene<TContext>;
  skipLoadingScreen?: boolean;
  maxFps?: number;
}

function loadRuntime<TContext>(
  runtime: Runtime<TContext>,
  options?: LoadRuntimeOptions<TContext>
): Promise<void>;
```

| Option | Default | Behavior |
|---|---|---|
| `loadingDelay` | `850` | Minimum time in milliseconds before asset loading begins. |
| `loadingContainer` | `document.body` | Element that contains the loading screen. |
| `assets` | Empty iterable | Additional references loaded before the initial scene. |
| `scene` | `undefined` | Initial scene prepared and queued before the runtime starts. |
| `skipLoadingScreen` | `false` | Starts without mounting or updating a loading screen. |
| `maxFps` | GPU estimate or `Infinity` | Overrides the render cap chosen during device setup. |

```ts
await loadRuntime(runtime, {
  assets: [sharedUiReference],
  scene: new GameScene(),
  maxFps: 144
});
```

## Startup order

With the loading screen enabled, its entrance animation, GPU detection, and
minimum delay run concurrently. Additional assets load next, followed by the
initial scene. The screen completes before the runtime starts.

`loadingDelay` controls the first phase only. Asset and scene loading can keep
the screen visible for longer.

When `skipLoadingScreen` is `true`, the canvas is shown immediately. Device
configuration, additional assets, and the initial scene run in that order;
`loadingDelay` and `loadingContainer` are ignored.

## Completion and errors

The returned promise resolves after `runtime.start()` has been called. Once the
loading screen has mounted, device, asset, and scene failures are displayed on
the screen and the promise rejects with the same `Error`. A loading-screen
mount failure rejects directly. With the screen skipped, startup errors also
reject directly.

The runtime remains stopped when device configuration, an asset batch, or the
initial scene fails.

See [customizing the loading screen](../guides/loading-screen.md) for container,
theme, and opt-out examples.
