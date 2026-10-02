# AnimationLoopFrameSource

[`FrameSource`](../framesource.md) for renderers that own the frame pump
through `setAnimationLoop()`, such as a three.js renderer or a WebXR session.

```ts
import {
  AnimationLoopFrameSource,
  GameLoop,
} from "@jolly-pixel/loop";

const loop = new GameLoop({
  source: new AnimationLoopFrameSource(renderer)
});
```

## Constructor

```ts
new AnimationLoopFrameSource(renderer: AnimationLoopRenderer);
```

Any object with this shape works. The package does not depend on `three`.

```ts
export type AnimationLoopRendererCallback = (time: number) => void;

export interface AnimationLoopRenderer {
  setAnimationLoop(callback: AnimationLoopRendererCallback | null): void;
}
```

## Members

| Member | Meaning |
| --- | --- |
| `start(callback)` | Passes `callback` to `setAnimationLoop()`, replacing the previous one. The first frame waits for the renderer. |
| `stop()` | Calls `setAnimationLoop(null)`. |

Timestamps come from the renderer.
