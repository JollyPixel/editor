# Debug panels

Tune a renderer or an example from JavaScript, with no template: the facade
builds the fields from a plain object and writes edits back into it. Add a
frame-time overlay with `jolly-stats`.

## 1. Create a pane

```ts
import { Pane } from "@jolly-pixel/ui/facade";

const settings = {
  enabled: true,
  opacity: 0.75,
  mode: "overlay",
  position: new THREE.Vector3(0, 0, 0)
};

const pane = new Pane({ title: "Renderer" });
```

- With no `container`, the pane floats under `document.body`, in a scope of
  its own. It can be moved and resized, and remembers where it was.
- `pane.dispose()` removes it, with its window and scope.

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

- The object is already updated when the handler runs.
- `last` is `true` once per committed edit, as in
  [Preview and commit](./preview-and-commit.md).
- A `THREE.Vector3` is written axis by axis, so the object keeps its identity.

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
const info = { calls: 0, frameMs: 0 };
const perf = pane.addFolder({ title: "Performance" });

perf.addMonitors(info, {
  calls: { label: "Draw calls" },
  frameMs: { label: "Frame", format: (value) => `${value.toFixed(1)} ms` }
});

function onFrame(): void {
  info.calls = renderer.info.render.drawCalls;
  info.frameMs = renderer.frameTime;
  perf.refresh();
}
```

Monitors have no timer. Refresh at the rate the numbers are worth reading,
not every frame of a fast loop.

## 6. Dock the panes on one side

Several debug panes read better in one collapsible dock than as separate
windows:

```html
<jolly-scope>
  <jolly-dock-layout storage-key="examples:layout">
    <jolly-dock id="tools" key="tools" side="right" align="start" size="340"
      overlay collapsible></jolly-dock>
  </jolly-dock-layout>
</jolly-scope>
```

```ts
import { DockFacade, Pane } from "@jolly-pixel/ui/facade";

const dock = DockFacade.query("#tools");

const config = new Pane({
  title: "Configuration",
  container: dock.element,
  grow: false,
  locked: true
});
config.addThemePreferences({ storageKey: "examples" });

const pane = new Pane({
  title: "Renderer",
  container: dock.element,
  grow: false,
  collapsible: true
});

dock.sync();

document.addEventListener("keydown", (event) => {
  if (event.key === "F3") {
    event.preventDefault();
    dock.hidden = !dock.hidden;
  }
});
```

- `overlay` lays the dock over the canvas instead of shrinking it.
- `dock.sync()` lets the layout adopt the new panes. Call it after adding
  them.
- `addThemePreferences` adds the theme and density controls, stored under
  `storageKey`.
- A page shared by several examples should declare the dock once, in its HTML,
  rather than create it from each example.

## 7. Add a frame-time overlay

```ts
import "@jolly-pixel/ui/elements/floating";
import "@jolly-pixel/ui/elements/stats";
import { StatsRecorder } from "@jolly-pixel/ui/stats";

const recorder = new StatsRecorder();
recorder.addMetric({
  id: "calls",
  label: "CALLS",
  better: "lower",
  sample: () => renderer.info.render.drawCalls
});

const stats = document.createElement("jolly-stats");
stats.recorder = recorder;
stats.storageKey = "examples:stats";
stats.style.width = "100%";
stats.style.height = "100%";

const floating = document.createElement("jolly-floating");
floating.x = 8;
floating.y = 8;
floating.width = 112;
floating.height = 56;
floating.storageKey = "examples:stats";
floating.append(stats);
document.querySelector("jolly-scope").append(floating);

function frame(): void {
  recorder.begin();
  renderer.render(scene, camera);
  recorder.end();
  requestAnimationFrame(frame);
}
```

- `@jolly-pixel/ui/stats` registers no element: `jolly-stats` and
  `jolly-floating` come from their `elements/` entry points.
- Clicking the overlay cycles through the built-in metrics (FPS, frame time,
  worst frame, heap when the browser reports it) and the added ones. The
  choice is stored under `storageKey`.
- `sample()` is read once per flush, every 250 ms by default. Use
  `track(id, value)` for values that arrive as events.
- Call `recorder.skipGap()` when the loop sleeps, so the pause does not show
  as a low FPS sample.
