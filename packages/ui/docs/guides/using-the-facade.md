# Using the facade

Build a settings panel from JavaScript, bound to a plain object. Every call
below is detailed in the [facade API](../api/facade/README.md).

## 1. Create a pane

```ts
import { Pane } from "@jolly-pixel/ui";

const settings = {
  enabled: true,
  opacity: 0.75,
  mode: "overlay",
  position: new THREE.Vector3(0, 0, 0)
};

const pane = new Pane({ title: "Renderer" });
```

With no `container`, the pane floats under `document.body`. Call
`pane.dispose()` when the view goes away.

## 2. Bind properties

```ts
pane.addBinding(settings, "enabled");
pane.addBinding(settings, "opacity", { min: 0, max: 1, step: 0.01 });
pane.addBinding(settings, "mode", {
  options: { Off: "off", Overlay: "overlay", Wireframe: "wireframe" }
});
pane.addBinding(settings, "position", { step: 1 });
```

The value picks the control: a checkbox, a slider, a select and a vector row.
See [control selection](../api/facade/binding.md#control-selection).

## 3. React to edits

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

The object is already updated when the handler runs. `last` is `true` once per
committed edit.

## 4. Group and add actions

```ts
const display = pane.addFolder({ title: "Display" });

display.addBinding(settings, "opacity", { min: 0, max: 1, step: 0.01 });
display.addSeparator();
display
  .addButton({ title: "Reset opacity" })
  .on("click", () => {
    settings.opacity = 1;
    display.refresh();
  });
```

Bindings do not observe assignments: call `refresh()` after changing the
object yourself.

## 5. Show live values

```ts
const stats = { calls: 0, frameMs: 0 };
const perf = pane.addFolder({ title: "Performance" });

perf.addMonitors(stats, {
  calls: { label: "Draw calls" },
  frameMs: { label: "Frame", format: (value) => `${value.toFixed(1)} ms` }
});

function onFrame(): void {
  stats.calls = renderer.info.render.drawCalls;
  stats.frameMs = renderer.frameTime;
  perf.refresh();
}
```

## 6. Mount in a dock

```ts
import { DockFacade, Pane } from "@jolly-pixel/ui";

const dock = DockFacade.query("#tools");
const inspector = new Pane({
  title: "Inspector",
  container: dock.element,
  collapsible: true
});

dock.sync();
```

The dock must sit in a `jolly-dock-layout` under a theme scope. See
[Docking and persistence](./docking-and-persistence.md).
