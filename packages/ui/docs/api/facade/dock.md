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
static DockFacade.query(
  selector: string,
  root?: ParentNode
): DockFacade
```

`query()` resolves the selector against `root`, which defaults to `document`,
and throws an `Error` naming the selector when it matches nothing or matches
an element that is not an upgraded `jolly-dock`. It is `from()` plus the
lookup every caller was writing by hand.

```ts
const dock = DockFacade.query("#tools");
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

