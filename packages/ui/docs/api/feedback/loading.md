# `jolly-loading`

`jolly-loading` renders the branded runtime startup and fatal-error screen.

```ts
const loading = document.createElement("jolly-loading");
document.body.append(loading);

await loading.start();
loading.setAsset("textures/world-atlas.png");
loading.setProgress(37, 120);
await loading.complete();
```

| Property | Type | Default |
|---|---|---|
| `started` | `boolean` | `false` |
| `completed` | `boolean` | `false` |

| Method | Behavior |
|---|---|
| `start()` | Shows the screen on the next animation frame |
| `setAsset(name)` | Sets the displayed asset text |
| `setProgress(value, max)` | Updates and clamps the current progress |
| `getProgressPercentage()` | Returns progress as a percentage |
| `complete(callback?)` | Fills, fades, removes, then calls the callback |
| `error(error)` | Replaces progress with an error view |
| `dismiss()` | Fades and removes the current view |

The error view uses the cause stack when `error.cause` is an `Error`.
