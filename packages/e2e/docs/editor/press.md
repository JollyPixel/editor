# Editor press

`pressAt(page, points, options?)` presses at the first point, moves through
the rest and releases. Editors sample input once per frame, so it waits
[`nextFrames(page, frames)`](./frames.md) after every pointer step to hold the
button across frames.

- `button`: `"left"` by default.
- `frames`: frames to wait per step, `nextFrames`' default when unset.
- `target`: a `Locator` reached with `target.hover()` instead of a raw mouse
  move. Raw presses skip Playwright's actionability checks, so an element
  covering the point takes the press without any error; with `target`,
  Playwright scrolls it into view and waits until it receives pointer events
  at that point, or fails naming the element on top.

```ts
await pressAt(page, [rowCenter, cellTop], {
  target: templateRow
});
```
