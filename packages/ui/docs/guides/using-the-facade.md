# Using the facade

The facade creates JollyPixel elements from JavaScript and binds controls to
object properties. Import `Pane` from the root package:

```ts
import { Pane } from "@jolly-pixel/ui";

const settings = {
  enabled: true,
  opacity: 0.75,
  mode: "overlay"
};

const pane = new Pane({ title: "Renderer" });
```

With no `container`, `Pane` appends a themed `jolly-floating` containing a
`jolly-pane` to `document.body`. Call `pane.dispose()` when the owning view is
destroyed.

## Add bindings

`addBinding()` reads the current property value, selects a control, and writes
edits back to the property.

```ts
pane.addBinding(settings, "enabled");
pane.addBinding(settings, "opacity", {
  label: "Opacity",
  min: 0,
  max: 1,
  step: 0.01
});
pane.addBinding(settings, "mode", {
  options: {
    Off: "off",
    Overlay: "overlay",
    Wireframe: "wireframe"
  }
});
```

The first binding creates `jolly-checkbox`. Bounds make the numeric binding a
`jolly-slider`, and `options` makes the string binding a `jolly-select`. See
[Binding facade](../api/facade/binding.md) for the full dispatch table.

## Bind a vector

A value carrying numeric axes dispatches to the matching math component, so a
position is one row rather than three sliders:

```ts
const area = {
  position: new THREE.Vector3(0, 0, 0),
  size: { x: 4, y: 1, z: 4 }
};

pane.addBinding(area, "position", { step: 1, label: "Min corner" });
pane.addBinding(area, "size", { min: 1, max: 24, step: 1 });
```

The axes are copied onto the bound object rather than replacing it, so
`area.position` is still the same `THREE.Vector3` after an edit. Pass
`view: "quaternion"` to read a four-axis value as a rotation, or
`view: "point2d"` to turn a two-axis value into a drag pad.

A binding handler runs after the object has been updated:

```ts
pane
  .addBinding(settings, "mode")
  .on("change", ({ value, last }) => {
    renderer.debugMode = value;
    if (last) {
      saveSettings(settings);
    }
  });
```

`last` is `false` for `jolly-input` and `true` for the committed
`jolly-change`. Use it when continuous input should update the application,
but persistence or history should run once per committed edit.

## Group controls and add actions

Folders expose the same methods as the pane, so they can contain bindings,
monitors, actions, presence views, and nested folders.

```ts
const display = pane.addFolder({
  title: "Display",
  expanded: true
});

display.addBinding(settings, "opacity", {
  min: 0,
  max: 1,
  step: 0.01
});
display.addSeparator();
display
  .addButton({ title: "Reset opacity" })
  .on("click", () => {
    settings.opacity = 1;
    display.refresh();
  });
```

Bindings do not observe object assignments. `refresh()` re-reads the values of
bindings and monitors created by that folder. `pane.refresh()` cascades into
every folder created through the pane.

## Display monitored values

`addMonitor()` creates a text monitor. Set `view: "graph"` for a numeric
history graph. `addMonitors()` adds several properties with one typed
configuration object. A vector property is joined into `x, y, z`.

```ts
const stats = {
  calls: 0,
  frameMs: 0
};

const performanceFolder = pane.addFolder({ title: "Performance" });
performanceFolder.addMonitors(stats, {
  calls: { label: "Draw calls" },
  frameMs: {
    label: "Frame",
    format: (value) => `${value.toFixed(1)} ms`
  }
});

function updatePerformance(): void {
  stats.calls = renderer.info.render.drawCalls;
  stats.frameMs = renderer.frameTime;
  performanceFolder.refresh();
}
```

Facade monitors have no timer. The application updates the backing object and
calls `refresh()` on its own cadence.

## Mount a pane in a dock

Pass a container to place the pane in existing markup. The container must
already be under a `jolly-scope` or another theme host.

```ts
import {
  DockFacade,
  Pane
} from "@jolly-pixel/ui";

const dockElement = document.querySelector<
  HTMLElementTagNameMap["jolly-dock"]
>("#tools");
if (dockElement === null) {
  throw new Error("Missing #tools dock");
}

const dock = DockFacade.from(dockElement);
const pane = new Pane({
  title: "Inspector",
  container: dock.element,
  grow: true,
  collapsible: true
});

dock.sync();
```

`DockFacade.from()` requires an upgraded `jolly-dock` inside a
`jolly-dock-layout`. Call `sync()` after adding panes so the layout reconciles
the new children.

## Manage builder state

Every returned builder has `element`, `hidden`, `disabled`, and `dispose()`.
Pane and folder builders also provide:

- `refresh()` re-reads direct bindings and monitors, including those inside
  folders created by the builder.
- `disposeAll()` disposes the direct builders it created and clears its
  internal child list.

Elements appended directly to a builder's `element` are outside that child
list. `disposeAll()` leaves them in place.

See the [facade API](../api/facade/README.md) for constructor options and each
returned builder surface.
