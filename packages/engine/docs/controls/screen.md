# Screen

Fullscreen manager. Requests and exits fullscreen mode on the canvas,
tracks state changes, and handles errors.

Automatically connected by `Input`, but can also be used standalone.

```ts
import { Screen } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const screen = new Screen({ canvas });

screen.connect();
screen.on("stateChange", (state) => {
  console.log("fullscreen", state);
});

// Fullscreen is acquired on the next mouse down
screen.enter();
```

## Constructor

### `new Screen(options)`

```ts
interface ScreenOptions {
  canvas: CanvasAdapter;
  // Custom document adapter (defaults to BrowserDocumentAdapter)
  documentAdapter?: DocumentAdapter;
}

new Screen(options: ScreenOptions);
```

## Types

```ts
type FullscreenState = "active" | "suspended";
```

## Events

```ts
type ScreenEvents = {
  stateChange: [FullscreenState];
};
```

## Properties

```ts
interface Screen {
  // Whether fullscreen has been requested
  wantsFullscreen: boolean;
  // Whether the canvas is currently fullscreen
  wasFullscreen: boolean;
}
```

## API

```ts
interface Screen {
  // Lifecycle
  connect(): void;
  disconnect(): void;
  reset(): void;

  // Request fullscreen (acquired on next mouse down)
  enter(): void;
  // Exit fullscreen and reset state
  exit(): void;

  // Called by Input to trigger fullscreen on mouse interaction
  onMouseDown(): void;
  onMouseUp(): void;
}
```
