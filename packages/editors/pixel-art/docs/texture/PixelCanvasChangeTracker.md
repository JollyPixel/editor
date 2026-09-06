# PixelCanvasChangeTracker

Tracks dirty bounds from a pixel canvas without depending on Three.js. Use it when a consumer needs canvas change batching but does not own a GPU texture.

```ts
import { PixelCanvasChangeTracker } from "@jolly-pixel/editor.pixel-art/texture/index.ts";

const changes = new PixelCanvasChangeTracker(canvas, { flush: "manual" });
const dirty = changes.consume();
changes.dispose();
```

`flush` accepts `"frame"`, `"immediate"`, or `"manual"`. `consume()` returns the union of pending dirty rectangles. `resized` and `replaced` are distinct events; both dirty the complete surface. `PixelCanvasTexture` composes this tracker and adds only Three.js texture ownership.
