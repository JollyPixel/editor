# Progress and loading

`jolly-progress` reports the state of one operation. `jolly-loading` is the branded startup
screen used by the runtime.

## Progress

Importing `@jolly-pixel/ui` registers `jolly-progress`. Runtime-only consumers can import
`@jolly-pixel/ui/feedback` without loading the controls and containers.

```html
<jolly-progress
  value="37"
  max="100"
  label="Loading assets"
></jolly-progress>
```

`value` and `max` are numbers. The rendered value is clamped between zero and `max`; invalid or
non-positive maximums use `1`. Remove `value` or assign `null` for an indeterminate operation.
The component leaves the supplied properties unchanged when it clamps the rendered result.

Set `valueText` when a number alone does not describe the work:

```ts
const progress = document.querySelector("jolly-progress");
progress.value = 37;
progress.max = 120;
progress.valueText = "37 of 120 assets";
```

`label` names the progress bar for assistive technology. Determinate bars expose `aria-valuenow`;
indeterminate bars omit it. Set `animated` for the pulse and shimmer treatment, and set
`completed` when the operation has settled. Reduced-motion preferences disable movement.

The shadow tree exposes `track` and `indicator` parts. These custom properties cover the common
theme changes:

| Property | Default |
| --- | --- |
| `--jolly-progress-height` | `4px` |
| `--jolly-progress-track` | `--jolly-groove` |
| `--jolly-progress-fill` | `--jolly-accent-fill` |
| `--jolly-progress-duration` | `--jolly-duration-base` |
| `--jolly-progress-easing` | `--jolly-easing` |
| `--jolly-progress-track-shadow` | `none` |
| `--jolly-progress-shadow` | `none` |
| `--jolly-progress-shadow-active` | `--jolly-progress-shadow` |

## Runtime loading screen

`jolly-loading` keeps the runtime startup contract. It starts hidden, shows on `start()`, fills
before `complete()` fades and removes it, and replaces its progress view with an error when
`error()` is called.

```ts
const loading = document.createElement("jolly-loading");
document.body.append(loading);

await loading.start();
loading.setAsset("textures/world-atlas.png");
loading.setProgress(37, 120);
await loading.complete();
```

`setAsset()` accepts a display string, so the component has no dependency on the asset package.
`complete()` handles an empty `0 / 0` load by filling the bar before the exit animation. The error
view uses the cause stack when `error.cause` is an `Error`.

Set the loading properties on `jolly-loading`, its container, or an ancestor. Custom properties
inherit through both shadow roots, including the nested `jolly-progress` element.

| Property | Default |
| --- | --- |
| `--jolly-loading-background` | `#eee` |
| `--jolly-loading-color` | `#444` |
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
