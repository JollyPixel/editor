# RuntimeMetrics

`runtime.metrics` holds the backend's metric source and mounts the two
displays of `runtime.stats`: the corner HUD and the readout panel. Register
your own metrics on `runtime.stats`, a
[`StatsRecorder`](../../../ui/docs/api/stats/stats-recorder.md).

```ts
const release = runtime.stats.addSource(engine.inspector);
await runtime.metrics.mount({ panel: { toggleKey: "F3" } });
```

## Properties

```ts
interface RuntimeMetrics<TMetrics> {
  /** The backend's `metrics` source, registered on `runtime.stats`. */
  readonly renderer: TMetrics;
  /** The mounted corner HUD, or `null`. */
  readonly hud: PerformanceStatsHud | null;
  /** The mounted readout panel, or `null`. */
  readonly panel: MetricsPanel | null;
}
```

## Methods

### mount(option?): Promise\<void\>

Mounts what `option` asks for, the HUD and the panel in parallel. With
`mount: false` the HUD already mounted stays as it is.

```ts
type PerformanceStatsOption = true | {
  mount?: boolean; // true, mounts the HUD
  position?: OverlayPosition; // "top-left"
  inset?: number; // 8, pixels from the canvas edges
  panel?: boolean | MetricsPanelOptions; // false, mounts the readout panel
};
```

### mountHud(placement?): Promise\<PerformanceStatsHud\>

Mounts the corner HUD on `runtime.overlay` and disposes the previous one.
`placement` takes the `position` and `inset` above.

### mountPanel(options?): Promise\<MetricsPanel\>

Mounts the [readout panel](#metricspanel) and disposes the previous one.

### dispose(): void

Removes the HUD and the panel. Called by `runtime.dispose()`.

## PerformanceStatsHud

The HUD cycles the tile metrics of `runtime.stats` and shows an `IDLE` badge
while the loop sleeps. Set `hidden` to hide it without unmounting it.

## MetricsPanel

The readout lists one folder per metric `group` and one row per metric.
Metrics registered later join it on their own.

```ts
interface MetricsPanel {
  /** Holds the rows. Add your own controls to it. */
  readonly container: FacadeContainer;
  /** Shows or hides the readout. */
  hidden: boolean;
  /** Removes the readout. */
  dispose(): void;
}
```

### MetricsPanelOptions

```ts
interface MetricsPanelOptions {
  /**
   * An `HTMLElement` receives a pane of its own; a `FacadeContainer` takes the
   * folders directly. @default floats over the page
   */
  target?: HTMLElement | FacadeContainer;
  /** Floats the pane inside an `HTMLElement` target. Target a `jolly-dock-layout` to make it dockable. @default false */
  floating?: boolean;
  /** Identity the pane persists and docks under. Required to dock. */
  key?: string;
  /** Pane heading, unused with a `FacadeContainer`. @default "Performance" */
  title?: string;
  /** Namespace the pane persists under. */
  storageKey?: string;
  /** `KeyboardEvent.code` toggling `hidden`, read from the world keyboard. */
  toggleKey?: string;
  /** Starts hidden. @default false */
  hidden?: boolean;
  /** Lets the created pane fold to its header. @default true */
  collapsible?: boolean;
  /**
   * Keeps only the metrics it accepts, later ones included.
   * `(metric) => metric.tile === false` drops what the HUD already cycles.
   */
  filter?: (metric: MetricDefinition) => boolean;
  /**
   * Unmounts the panel and clears `panel`. Aborted before `mountPanel()`
   * resolves, the mount is dropped and the current panel stays.
   */
  signal?: AbortSignal;
}
```
