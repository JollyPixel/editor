# Pointer

Geometry and pointer helpers built on a `Locator`'s bounding box.

| Function | |
|---|---|
| `boxOf(locator)` | bounding box; throws when the element is not visible |
| `centerOf(locator)` | center point of the box |
| `widthOf(locator)`, `heightOf(locator)` | fractional client size |
| `hold(page, from, to, steps?)` | presses at `from`, moves to `to`, keeps the button down |
| `dragTo(page, handle, target)` | drags `handle` from its center and releases |
| `scrubBy(page, handle, distance)` | horizontal drag by `distance` pixels |
| `pressAt(page, points, options?)` | presses at the first point, moves through the rest, releases |

`pressAt` takes `button` (default `"left"`) and `settle`, awaited after every
pointer step. Editors sample input once per frame, so they pass
`settle: nextFrames` ([editor navigation](./editor-navigation.md#frames)) to
hold the button across frames.
