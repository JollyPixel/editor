# Facade

`src/facade/` is the builder layer SPEC section 1 describes: a thin constructor over the elements,
for examples that want Tweakpane's ergonomics instead of templates.

```ts
import { Pane } from "@jolly-pixel/ui";

const pane = new Pane({ title: "voxel.renderer" });
const grid = pane.addFolder({ title: "Grid" });
grid.addBinding(state, "enabled");
grid.addMonitor(state, "fps");
```

`Pane` and `DockFacade` are the barrel's entry points. `addFolder`, `addBinding`, `addMonitor`,
`addButton`, and `addSeparator` each return a builder object rather than a constructible class, the
same way `folder.addBinding(...)` never asks a consumer to name `BindingApi` in Tweakpane.

## Pane

`new Pane({ title })` creates a `jolly-pane`, wraps it in a `jolly-floating`, and appends the
floating window to `document.body` — Tweakpane's own default. `jolly-pane` reads inherited tokens
but declares none itself (only `jolly-dialog` self-scopes), so `Pane` gives its floating window its
own shadow-root theme scope; no setup is needed to get a themed, non-transparent pane.

Pass `container` to mount into an existing element instead — a `jolly-dock`, for a pane that sits
in a layout rather than floating. The container's own subtree must already sit under a theme
scope; unlike the default floating window, `Pane` does not supply one in this mode:

```ts
const dock = document.createElement("jolly-dock");
dock.side = "right";
dock.align = "start";
// dock's ancestor already applies themeStyles
const pane = new Pane({ title: "Inspector", container: dock });
```

In `container` mode, `grow` (default `true`) fills the container's available space and scrolls the
pane's own content, matching `jolly-dock`'s `grow` attribute. Set it `false` on every pane but the
last when stacking several into one aligned dock — a compact chrome pane above a scrolling content
pane, for instance — so only the last one claims the leftover space:

```ts
const chrome = new Pane({
  title: "Example",
  container: dock,
  grow: false,
  locked: true
});
const content = new Pane({ title: "Grid", container: dock }); // grow: true by default
```

Set `locked: true` for fixed dock furniture. A locked pane cannot be dragged or moved with the
keyboard when its dock belongs to a `jolly-dock-layout`.

## DockFacade

`DockFacade.from(dock)` wraps a declarative dock that already belongs to an upgraded layout. It
exposes `element`, `hidden`, and `sync()`, which reconciles panes added after the layout first
rendered:

```ts
const dock = DockFacade.from(
  document.querySelector("#tools")!
);
const pane = new Pane({ container: dock.element, title: "Inspector" });
dock.sync();
```

## Folder

`pane.addFolder({ title, expanded })` nests a `jolly-folder`. `title` maps onto the element's
`label`, kept under Tweakpane's own option name. `expanded` (default `true`) maps onto `open`.

Call `folder.disposeAll()` to remove every direct builder added through that facade, then rebuild
the folder with fresh controls. It does not remove elements appended to `folder.element` directly.

## Binding

`addBinding(object, key, options)` dispatches an element from `object[key]`'s value and, where
given, `options`:

| Value / options | Element |
|---|---|
| `boolean` | `jolly-checkbox` |
| `number`, no `min` and `max` | `jolly-number` |
| `number`, `min` and `max` both set | `jolly-slider` |
| `string`, matches `#rrggbb` or `#rrggbbaa` | `jolly-color` |
| `string`, otherwise | `jolly-text` |
| any value, with `options.options` | `jolly-select` |
| `{ from, to }` | `jolly-range` |

`options.options` wins outright: a value bound alongside a choice list is always a select. `step`
alone, with no bounds, keeps a number field a `jolly-number` rather than a slider.

`options.align` sets the dispatched control's `align`. A checkbox defaults to `"end"`, since a
small fixed-size control reads as lost at the leading edge of a row otherwise; every other control
defaults to `"start"`, unchanged.

The element writes straight back to `object[key]` on `jolly-input` and `jolly-change`, the same
controlled write-back every field already needs (see [fields.md](./fields.md)). For anything past
that, `on("change", ({ value, last }) => void)` fires after the write-back, once per `jolly-input`
(`last: false`) and once per `jolly-change` (`last: true`):

```ts
folder.addBinding(target, "extent", { min: 5, max: 500, step: 5 })
  .on("change", ({ value, last }) => {
    if (last) {
      rebuildGrid({ extent: value });
    }
  });
```

## Monitor

`addMonitor(object, key, options)` renders a read-only row. `addMonitors(object, fields)` adds a
typed batch of number and string properties using the same options:

```ts
folder.addMonitors(stats, {
  fps: { label: "fps", format: formatCount },
  frameMs: { label: "frame", format: formatMilliseconds }
});
```

See
[monitors.md](./monitors.md) for `jolly-monitor`, `jolly-graph`, and the `view: "graph"` flag that
picks between them.

## Button and Separator

`addButton({ title })` returns a `jolly-button` wrapper with `on("click", handler)`.
`addSeparator()` returns a plain `jolly-separator`; Tweakpane calls this a "Blade" and gives it a
`view` option, but nothing else in `ui` uses that vocabulary and no second blade kind exists here.

## Shared surface

Every builder — `Pane`, `Folder`, `Binding`, `Monitor`, `Button`, and the object `addSeparator()`
returns — exposes `element`, `hidden`, `disabled`, and `dispose()`, matched by the exported
`Disposable` type for a consumer collecting a mixed batch to dispose together (Tweakpane's own
`BladeApi`):

```ts
const bindings: Disposable[] = [];
bindings.push(folder.addBinding(state, "enabled"), folder.addSeparator());
// ...later
for (const binding of bindings) {
  binding.dispose();
}
```

`Pane` and `Folder` additionally expose `refresh()`, which cascades to every `Folder`, `Binding`,
and `Monitor` added through them — call it after mutating a bound object directly, the way
`PerformancePanel` refreshes its stats each frame.

`disposeAll()` removes every direct builder the container created and clears its refresh list, for
when a folder's controls are rebuilt around a replacement object.

## Not built

`exportState`/`importState`. No current consumer serializes pane state, and there is nothing to
validate a format against; see SPEC section 16.
