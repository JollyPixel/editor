# Screen

Fullscreen manager. Requests and exits fullscreen mode on the canvas,
tracks state changes, and handles errors.

Automatically connected by `Input`, but can also be used standalone.

```ts
import { Screen } from "@jolly-pixel/controls";

const canvas = document.querySelector("canvas");
if (!canvas) {
  throw new Error("No canvas element found");
}
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

  // Called by Input on both mouse.down and mouse.up to trigger fullscreen
  // from a user gesture
  requestFullscreenIfWanted(): void;

  // Each read computes and returns a fresh object; cache it per frame
  // rather than reading it repeatedly.
  // Canvas client dimensions
  size: Vector2Like;
  // Canvas bounds centered at origin (useful for orthographic cameras)
  bounds: { left: number; right: number; top: number; bottom: number; };
}
```
