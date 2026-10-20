# Pointer

Geometry and pointer helpers built on a `Locator`'s bounding box.

| Function | |
|---|---|
| `measureBox(locator)` | bounding box; throws when the element is not visible |
| `measureBoxes(locator)` | client rect of every matched element, in DOM order |
| `boxesOverlap(a, b)` | whether two boxes cross; sharing an edge does not count |
| `measureCenter(locator)` | center point of the box |
| `measureWidth(locator)`, `measureHeight(locator)` | fractional client size |
| `hold(page, from, to, steps?)` | presses at `from`, moves to `to`, keeps the button down |
| `dragTo(page, handle, target)` | drags `handle` from its center and releases |
| `scrubBy(page, handle, distance)` | horizontal drag by `distance` pixels |

Presses that must span editor frames use
[`pressAt`](../editor/press.md) from `@jolly-pixel/e2e/editor`.
