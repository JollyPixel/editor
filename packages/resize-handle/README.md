<h1 align="center">
  resize-handle
</h1>

<p align="center">
  A modern and robust resize-handle / splitter library for your HTML5 apps and websites, inspired by <a href="https://github.com/sparklinlabs/resize-handle">sparklinlabs/resize-handle</a>
</p>

## 💡 Features

- **Single-axis handles**: `ResizeHandle` resizes one edge (`left`/`right`/`top`/`bottom`) by pointer or keyboard, with `minSize`/`maxSize` bounds
- **Corner handle**: `CornerResizeHandle` resizes width and height together from a single pointer drag, reusing the same per-axis math
- **Collapsible edges**: double-click a `collapsible` handle to zero the target's size, double-click again to restore it
- **Keyboard resizing**: arrow keys move a handle by 8px, Shift for a 32px step; keyboard input clamps to the same bounds and fires the same drag events as pointer input
- **Accessible by default**: edge handles are focusable `role="separator"` elements with live `aria-valuemin`/`aria-valuemax`/`aria-valuenow`
- **Locked drag cursor**: the whole document keeps the resize cursor while dragging, even if the pointer outruns the handle's own hit area

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

const sidebar = document.querySelector<HTMLElement>("#sidebar");
if (sidebar === null) {
  throw new Error("Missing #sidebar element");
}

// Creates a drag handle and inserts it next to the sidebar.
// Dragging the handle resizes the sidebar horizontally.
const handle = new ResizeHandle(sidebar, {
  direction: "left",
  collapsible: true,
  minSize: 200,
  maxSize: 600
});

handle.addEventListener("dragStart", () => console.log("resize started"));
handle.addEventListener("drag", () => console.log("resizing…"));
handle.addEventListener("dragEnd", () => console.log("resize ended"));

// Removes listeners and removes a handle created by this instance.
handle.dispose();
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

## 🧪 Demo

Run `npm run dev -w @jolly-pixel/resize-handle` from the repository root. 

## 📚 API

- [ResizeHandle](./docs/ResizeHandle.md): single-axis resize handle and collapsing.
- [CornerResizeHandle](./docs/CornerResizeHandle.md): two-axis corner resizing.

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
