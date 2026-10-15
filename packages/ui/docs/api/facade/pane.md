# `Pane` facade

`Pane` creates a `jolly-pane` and is the entry point of the facade. It is a
[container](./README.md#containers): it has every `add*()` method.

```ts
new Pane(options?: PaneOptions)

interface PaneOptions extends FieldLayoutOptions {
  title?: string; // the jolly-pane heading
  key?: string; // persistence and group identity, required to join a group
  icon?: IconName;
  tone?: IconTone;
  container?: HTMLElement; // mount here instead of floating
  grow?: boolean; // fill and scroll the container, default true
  floating?: boolean; // float inside container, see below
  collapsible?: boolean;
  locked?: boolean; // keep the authored place in a dock layout
  storageKey?: string; // persistence namespace
  labelWidth?: string; // --jolly-label-width
  hidden?: boolean;
  floatWidth?: number;
  floatHeight?: number;
}

interface FieldLayoutOptions {
  labelPosition?: "inline" | "top" | "auto";
  stackBelow?: number;
}
```

- `storageKey` defaults to the page path plus the title, so renaming the pane
  drops what it remembered.
- `hidden` on a floating pane is persisted, and a stored value wins.
- `pane.presence` sets the [`PresenceSource`](../peer/presence-source.md) of
  the `jolly-pane`.
- `dispose()` removes the pane, its window and the scope it created.

## Floating and mounted panes

Without `container`, the pane floats under `document.body`:

```text
document.body
└── jolly-scope
    └── jolly-floating
        └── jolly-pane
```

- `pane.element` is the `jolly-floating`.
- The scope sets `--jolly-label-width` to `labelWidth`, default `16ch`.

With `container`, only the `jolly-pane` is appended:

- `pane.element` is the `jolly-pane`.
- The container must already be under a
  [theme scope](../../guides/theming-and-density.md).
- `--jolly-label-width` defaults to `auto` there. Pass `labelWidth` to align
  the value columns.

```ts
const pane = new Pane({
  title: "Inspector",
  container: document.querySelector("#inspector"),
  grow: false
});
```

## Field layout

`labelPosition` and `stackBelow` become the default of every binding and note
in the pane, folders included. Options given to `addBinding()` or `addNote()`
win. See [label position](../field/shared-field-api.md#label-position).

```ts
const pane = new Pane({
  title: "Inspector",
  labelPosition: "auto",
  stackBelow: 220
});
```

## Floating inside a dock layout

A pane floating under `document.body` belongs to no layout and cannot be
docked. Pass the layout as `container` with `floating`:

```ts
const pane = new Pane({
  title: "Performance",
  key: "performance",
  container: document.querySelector("jolly-dock-layout"),
  floating: true
});
```

- The layout adopts the window on its next sync and stores its geometry.
- The window docks into any dock or group, addressed by `key`.
- Docking removes the window, so `pane.element` can be detached. `hidden` and
  `dispose()` act on the current window, or on the `jolly-pane` while docked.

## `FacadeHost`

Adds builders inside an element the facade did not create, such as a pane
authored in HTML.

```ts
new FacadeHost(element: HTMLElement)
FacadeHost.query(selector: string, root?: ParentNode): FacadeHost

const host = FacadeHost.query("jolly-pane[key=general]");
const folder = host.addFolder({ title: "Performance" });
```

- Several hosts can contribute to one element.
- `dispose()` disposes what the host added and leaves the element.
- `query()` throws when the selector matches nothing.
