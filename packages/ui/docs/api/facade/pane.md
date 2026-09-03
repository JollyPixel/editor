# `Pane` facade

`Pane` is the facade entry point.

```ts
new Pane(options?: PaneOptions)

interface PaneOptions {
  title?: string;
  container?: HTMLElement;
  grow?: boolean;
  collapsible?: boolean;
  locked?: boolean;
  storageKey?: string;
}
```

| Option | Default | Behavior |
|---|---|---|
| `title` | `""` | Sets the `jolly-pane` heading. |
| `container` | none | Appends the pane to this element. Without it, the pane floats under `document.body`. |
| `grow` | `true` in container mode | Makes a mounted pane fill the container and scroll its content. Ignored for a floating pane. |
| `collapsible` | `false` | Enables folding the pane to its header. |
| `locked` | `false` | Keeps the pane at its authored position inside a `jolly-dock-layout`. |
| `storageKey` | derived | Namespace the pane and its floating window persist under. Derived from the page path and the title when unset, so renaming the pane drops what it remembered. |

## Floating and mounted panes

Without `container`, the constructor creates this structure:

```text
document.body
└── jolly-scope
    └── jolly-floating
        └── jolly-pane
```

The scope supplies theme tokens and sets `--jolly-label-width` to `16ch`.
`pane.element` is the `jolly-floating` wrapper in this mode.

With `container`, the constructor appends only `jolly-pane` and
`pane.element` is that pane. The container must already be inside a theme
scope. See [Theming and density](../../guides/theming-and-density.md).

```ts
const container = document.querySelector("#inspector");
if (!(container instanceof HTMLElement)) {
  throw new Error("Missing #inspector");
}

const pane = new Pane({
  title: "Inspector",
  container,
  grow: false
});
```

## Methods

| Method | Return | Behavior |
|---|---|---|
| `addFolder(options?)` | Folder builder | Appends a `jolly-folder`. |
| `addBinding(object, key, options?)` | Binding builder | Appends a dispatched field bound to `object[key]`. |
| `addMonitor(object, key, options?)` | Monitor builder | Appends one read-only value. |
| `addMonitors(object, fields)` | `void` | Adds each configured number or string property. |
| `addButton(options?)` | Button builder | Appends a `jolly-button`. |
| `addSeparator()` | Separator builder | Appends a `jolly-separator`. |
| `addPresence(options?)` | `Presence` | Appends a `jolly-presence`. |
| `refresh()` | `void` | Re-reads bindings and monitors created through this pane. |
| `disposeAll()` | `void` | Disposes direct child builders and clears the child list. |
| `dispose()` | `void` | Removes `element`. |

`hidden` and `disabled` read and write the corresponding state on
`pane.element`.

