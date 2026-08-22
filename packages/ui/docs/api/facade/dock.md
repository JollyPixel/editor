# `DockFacade`

`DockFacade` wraps a `jolly-dock` whose layout is authored in HTML.

```ts
static DockFacade.from(
  element: HTMLElementTagNameMap["jolly-dock"]
): DockFacade
```

`from()` finds the nearest `jolly-dock-layout`. It throws an `Error` when the
dock is outside a layout or the layout has not upgraded to `DockLayout`.

```ts
const dockElement = document.querySelector<
  HTMLElementTagNameMap["jolly-dock"]
>("#tools");
if (dockElement === null) {
  throw new Error("Missing #tools dock");
}

const dock = DockFacade.from(dockElement);
const inspector = new Pane({
  title: "Inspector",
  container: dock.element,
  grow: true
});

dock.sync();
```

Call `sync()` after code adds panes to the dock. It asks the owning
`jolly-dock-layout` to reconcile children added after its initial render.

The facade exposes:

| Member | Behavior |
|---|---|
| `element` | The wrapped `jolly-dock`. |
| `hidden` | Reads or writes `element.hidden`. |
| `sync()` | Reconciles the owning layout. |

`DockFacade` does not create, move, or dispose the authored dock.

