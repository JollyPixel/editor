<h1 align="center">
  resize-handle
</h1>

<p align="center">
  Robust resize handles / splitters for your HTML5 apps and websites
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/resize-handle
# or
$ yarn add @jolly-pixel/resize-handle
```

## 👀 Usage example

```ts
import { ResizeHandle } from "@jolly-pixel/resize-handle";

const sidebar = document.getElementById("sidebar") as HTMLElement;

// Creates a drag handle and inserts it next to the sidebar.
// Dragging the handle resizes the sidebar horizontally.
const handle = new ResizeHandle(sidebar, {
  direction: "left",
  collapsable: true
});

handle.addEventListener("dragStart", () => console.log("resize started"));
handle.addEventListener("drag", () => console.log("resizing…"));
handle.addEventListener("dragEnd", () => console.log("resize ended"));
```

Then style the handle and the global drag-cursor helpers in your CSS:

```css
.resize-handle {
  width: 4px;
  cursor: ew-resize;
  background: #ccc;
}

.resize-handle.top,
.resize-handle.bottom {
  height: 4px;
  cursor: ns-resize;
}

/* Applied to <html> while dragging — lock the cursor globally */
html.handle-dragging.vertical  * { cursor: ew-resize !important; }
html.handle-dragging.horizontal * { cursor: ns-resize !important; }
```

To temporarily disable a handle without destroying it, add the `disabled` CSS class to `handle.handleElt`. The handle will stop responding to pointer events until the class is removed.

## 📚 API

### `ResizeHandleOptions`

```ts
interface ResizeHandleOptions {
  /**
   * The direction in which the handle resizes the target.
   * Also controls where the handle element is inserted in the DOM:
   * - "left" / "top"  → handle inserted after the target
   * - "right" / "bottom" → handle inserted before the target
   */
  direction: "left" | "right" | "top" | "bottom";
  /**
   * When true, double-clicking the handle collapses the target to zero size.
   * Double-clicking again restores the previous size.
   * @default false
   */
  collapsable?: boolean;
}
```

### `new ResizeHandle(targetElt, options)`

Creates a resize handle for `targetElt`. A `<div class="resize-handle">` is inserted adjacent to the target in the DOM. If a matching `div.resize-handle` sibling already exists it is reused.

Throws an `Error` if `direction` is not one of the four valid values.

`ResizeHandle` extends `EventTarget`. The following events are dispatched on the instance:

- **`"dragStart"`** — fired when the user presses the left mouse button on the handle.
- **`"drag"`** — fired on each `pointermove` while dragging.
- **`"dragEnd"`** — fired when the pointer is released or cancelled.

### CSS classes

The handle element (`handleElt`) receives these classes automatically:

- `resize-handle` — always present, identifies the element.
- `"left"` / `"right"` / `"top"` / `"bottom"` — matches the `direction` option.
- `collapsable` — present when `collapsable: true`.
- `disabled` — add this yourself to pause drag interaction without destroying the handle.

While a drag is in progress, `<html>` receives:

- `handle-dragging` — always set during a drag.
- `vertical` — set for horizontal handles (`"left"` / `"right"`).
- `horizontal` — set for vertical handles (`"top"` / `"bottom"`).

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
