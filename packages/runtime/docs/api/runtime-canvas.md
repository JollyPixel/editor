# Runtime canvas

The runtime accepts a canvas element or a selector that resolves to one.

## API

```ts
type RuntimeCanvasTarget = HTMLCanvasElement | string;

function resolveRuntimeCanvas(
  target: RuntimeCanvasTarget
): HTMLCanvasElement;
```

`Runtime.create()` calls `resolveRuntimeCanvas()` before creating the renderer.
Applications can call the helper directly when they need the same validation.

```ts
const canvas = resolveRuntimeCanvas("#game");
const runtime = await Runtime.create(canvas);
```

Passing an `HTMLCanvasElement` returns the same element. A selector is resolved
with `document.querySelector()`.

The function throws when an object is not an `HTMLCanvasElement`, a selector
matches no element, or the matching element is not a canvas.

