# Customizing the loading screen

[`loadRuntime()`](../api/loadRuntime.md) mounts a `jolly-loading` element while
it configures the device and prepares startup assets. The element is supplied
by `@jolly-pixel/ui`.

## Choose the container

The loading screen is appended to `document.body` by default. Pass another
element when the runtime lives inside an application shell:

```ts
const container = document.querySelector<HTMLElement>("#game-shell");
if (container === null) {
  throw new Error("Game shell was not found.");
}

await loadRuntime(runtime, {
  loadingContainer: container,
  scene: new GameScene()
});
```

If the container already has a direct `jolly-loading` child, the runtime reuses
it. This allows application code to create and configure the element first.

## Set the minimum delay

The default minimum delay is 850 milliseconds. A delay of zero removes the
timer, although device, asset, scene, and screen animations still determine the
actual startup time.

```ts
await loadRuntime(runtime, {
  loadingDelay: 0,
  scene: new GameScene()
});
```

## Theme the screen

Set the loading variables on the container or one of its ancestors. CSS custom
properties inherit through the loading element's shadow root.

```css
#game-shell {
  --jolly-loading-color: #f5f7ff;
  --jolly-loading-background: #121621;
  --jolly-loading-asset-color: #bac4dc;
  --jolly-loading-progress-start: #4e8cff;
  --jolly-loading-progress-middle: #60c7ff;
  --jolly-loading-progress-end: #87f0d0;
  --jolly-loading-error-color: #ff796f;
}
```

| Property | Default |
|---|---|
| `--jolly-loading-color` | `#444` |
| `--jolly-loading-background` | `#eee` |
| `--jolly-loading-asset-color` | `#282e38` |
| `--jolly-loading-progress-track-start` | `#b8bfb0` |
| `--jolly-loading-progress-track-middle` | `#d0d4c3` |
| `--jolly-loading-progress-track-end` | `#b8bfb0` |
| `--jolly-loading-progress-start` | `#2a5d8f` |
| `--jolly-loading-progress-middle` | `#3e7cb8` |
| `--jolly-loading-progress-end` | `#4a8fd8` |
| `--jolly-loading-progress-glow` | `rgba(62, 124, 184, 0.5)` |
| `--jolly-loading-progress-glow-subtle` | `rgba(62, 124, 184, 0.3)` |
| `--jolly-loading-progress-glow-strong` | `rgba(62, 124, 184, 0.7)` |
| `--jolly-loading-error-color` | `#bf360c` |
| `--jolly-loading-error-background` | `#cfd8dc` |
| `--jolly-loading-error-text-color` | `#182024` |

The [`jolly-loading` API](../../../ui/docs/api/feedback/loading.md) documents
the underlying element's properties and methods.

## Start without a screen

Use `skipLoadingScreen` when the host application owns startup feedback:

```ts
await loadRuntime(runtime, {
  skipLoadingScreen: true,
  scene: new GameScene()
});
```

The runtime shows the canvas immediately and ignores `loadingDelay` and
`loadingContainer`. Device setup and startup loading still run before the game
loop starts.

