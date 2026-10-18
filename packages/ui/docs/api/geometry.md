# Geometry types

`Rect` is the exported rectangle shape used by drag and drop helpers:

```ts
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

## anchoredPosition

`anchoredPosition(options)` returns the `{ x, y }` viewport position of a panel
placed against an anchor rectangle:

```ts
import { anchoredPosition } from "@jolly-pixel/ui";

const { x, y } = anchoredPosition({
  anchor: button.getBoundingClientRect(),
  panel: { width: 240, height: 120 },
  viewport: { width: innerWidth, height: innerHeight },
  gap: 8,
  side: "right"
});
```

- `anchor` is an `AnchorRect` (`top`, `bottom`, `left`, `right`) in viewport
  pixels; a `DOMRect` fits.
- `side` is the preferred side, `"above"`, `"below"` (default), `"left"` or
  `"right"`. The panel flips to the opposite side when it does not fit there
  and fits on the other one.
- `align` is `"start"` (default), aligned with the anchor's top or left edge,
  `"center"`, or `"end"`, aligned with its bottom or right edge.
- The result is clamped to the viewport. A panel larger than the viewport
  starts at its edge.
