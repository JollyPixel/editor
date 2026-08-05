// Import Third-party Dependencies
import { Pane, type FolderApi } from "tweakpane";

// CONSTANTS
const kDefaultTitle = "voxel.renderer";
const kToggleKey = "F3";
/** Label → path, as consumed by the switcher's `options`. */
const kExamples: Record<string, string> = {
  Physics: "/",
  "Block Shapes": "/shapes.html",
  "Tileset UV": "/tileset.html",
  "Tiled Map": "/tiled.html",
  "Noise World": "/noise-world.html",
  "Flat World (Sync)": "/flat-world.html",
  "Transparency & Light": "/transparency.html"
};

export interface ExamplePaneOptions {
  /**
   * @default "voxel.renderer"
   */
  title?: string;
}

/**
 * Panel shared by every example page: an example switcher on top, then whatever
 * folders the demo attaches to the returned pane. `F3` toggles the whole panel.
 */
export function createExamplePane(
  options: ExamplePaneOptions = {}
): Pane {
  const { title = kDefaultTitle } = options;

  const pane = new Pane({ title });
  const current = currentExample();

  pane
    .addBinding({ example: current }, "example", {
      // A list binding is used over `addBlade({ view: "list" })`: it keeps the
      // change payload typed instead of returning a bare BladeApi.
      options: kExamples,
      label: "example"
    })
    .on("change", ({ value }) => {
      if (value !== current) {
        window.location.assign(value);
      }
    });

  document.addEventListener("keydown", (event) => {
    if (event.key !== kToggleKey) {
      return;
    }

    event.preventDefault();
    pane.hidden = !pane.hidden;
  });

  return pane;
}

/**
 * `/index.html` and `/` are the same page; the switcher only knows the latter.
 */
function currentExample(): string {
  const { pathname } = window.location;

  return pathname === "/index.html" ? "/" : pathname;
}

export type MonitorState = Record<string, number | string>;

export interface MonitorField {
  label: string;
  /** Number monitors only; ignored for string values. */
  format?: (value: number) => string;
}

export type MonitorFields<TState extends MonitorState> = {
  [K in keyof TState]?: MonitorField;
};

/**
 * Binds the named fields of `state` as read-only rows. Tweakpane's polling
 * ticker is left off (`interval: 0`): the caller decides when the values are
 * fresh and calls `folder.refresh()`.
 */
export function addMonitors<TState extends MonitorState>(
  folder: FolderApi,
  state: TState,
  fields: MonitorFields<TState>
): void {
  for (const [key, field] of Object.entries(fields)) {
    if (!field) {
      continue;
    }

    folder.addBinding(state, key, {
      readonly: true,
      interval: 0,
      label: field.label,
      format: field.format
    });
  }
}

export function formatCount(
  value: number
): string {
  return Math.round(value).toLocaleString("en-US");
}

export function formatMilliseconds(
  value: number
): string {
  return `${value.toFixed(1)} ms`;
}

export function formatPercent(
  value: number
): string {
  return `${value.toFixed(1)} %`;
}
