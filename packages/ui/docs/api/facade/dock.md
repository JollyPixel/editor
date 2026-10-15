# `DockFacade`

`DockFacade` wraps a `jolly-dock` authored in HTML. It does not create, move
or dispose the dock.

```ts
const dock = DockFacade.query("#tools");
const inspector = new Pane({
  title: "Inspector",
  container: dock.element,
  grow: true
});

dock.sync();
```

## Static methods

### `DockFacade.from(element: HTMLElementTagNameMap["jolly-dock"]): DockFacade`

Throws an `Error` when the dock is outside a `jolly-dock-layout`, or the
layout has not upgraded.

### `DockFacade.query(selector: string, root?: ParentNode): DockFacade`

`from()` plus the lookup, in `root` (default `document`). Throws an `Error`
naming the selector when it matches no upgraded `jolly-dock`.

## Members

```ts
interface DockFacade {
  readonly element: HTMLElementTagNameMap["jolly-dock"];
  hidden: boolean;
  sync(): void;
}
```

Call `sync()` after adding panes, so the layout reconciles them.
