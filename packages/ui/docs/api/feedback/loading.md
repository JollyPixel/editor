# `jolly-loading`

`jolly-loading` renders the branded runtime startup and fatal-error screen.

```ts
const loading = document.createElement("jolly-loading");
document.body.append(loading);

await loading.start();
loading.showAsset("textures/world-atlas.png");
loading.updateProgress(37, 120);
await loading.complete();
```

## Properties

```ts
interface Loading {
  readonly started: boolean;
  readonly completed: boolean;
}
```

## Methods

### `start(): Promise<void>`

Shows the screen on the next animation frame.

### `showAsset(name: string): void`

Sets the asset text.

### `updateProgress(value: number, max: number): void`

Updates the progress, clamped.

### `progressPercentage: number`

### `complete(callback?: () => void): Promise<void>`

Fills the bar, fades out, removes the element, then calls `callback`.

### `error(error: Error): void`

Replaces the progress with an error view. Shows the stack of `error.cause`
when it is an `Error`.

### `dismiss(): Promise<void>`

Fades out and removes the current view.
