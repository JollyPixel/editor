<h1 align="center">
  resize-handle
</h1>

<p align="center">
  A modern and robust resize-handle / splitter library for your HTML5 apps and websites, inspired by <a href="https://github.com/sparklinlabs/resize-handle">sparklinlabs/resize-handle</a>
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

## 🧪 Demo

Run `npm run dev -w @jolly-pixel/resize-handle` from the repository root. The demo includes
horizontal and vertical handles with size bounds, keyboard control, and double-click collapse.

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

See the [API reference](./docs/API.md) for constructor options, events, keyboard behavior,
cleanup, resize math, and CSS classes.

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
