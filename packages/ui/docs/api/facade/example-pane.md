# `createExamplePane()`

`createExamplePane()` sets up the tools dock of a package's example pages and
returns the pane an example fills with its own controls.

```ts
import { createExamplePane } from "@jolly-pixel/ui/facade";

const pane = createExamplePane({
  title: "Block Shapes",
  examples: {
    Home: "/",
    "Rendering: Block Shapes": "/shapes/"
  },
  storageKey: "voxel-renderer-examples"
});

pane.addBinding(settings, "wireframe");
```

```ts
interface ExamplePaneOptions {
  title: string; // heading of the returned pane
  examples: Record<string, string>; // label to page path
  storageKey: string;
}

function createExamplePane(options: ExamplePaneOptions): Pane;
```

- Uses the `jolly-dock` with id `tools` when the page has one. Otherwise it
  creates an overlay dock on the right, 340px wide, in the page's
  `jolly-dock-layout`, creating that layout in the `jolly-scope` when needed.
  Throws an `Error` when the page has neither a layout nor a scope.
- A created layout persists under `<storageKey>:layout`.
- A locked "Examples" pane comes first. It selects the current page from
  `examples`, matched against the path without a trailing `index.html`, and
  navigates when another entry is chosen. It also holds the theme
  preferences, stored under `storageKey`.
- Pressing F3 shows or hides the dock.
- The returned [`Pane`](./pane.md) is collapsible and sits below the
  Examples pane.
