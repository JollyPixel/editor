// Import Third-party Dependencies
import { Pane, type FolderApi } from "tweakpane";

// CONSTANTS
const kDefaultTitle = "three";
const kToggleKey = "F3";
// Targeted by main.css to pin the switcher to the top of the (scrollable)
// panel — see the `.tp-example-pin` rule there.
const kExamplePinClass = "tp-example-pin";
/** Label → path, as consumed by the switcher's `options`. */
const kExamples: Record<string, string> = {
  Grid: "/",
  "Peer Frustum": "/peer-frustum.html",
  "Peer Frustum Sync": "/peer-frustum-sync.html"
};

export interface ExamplePaneOptions {
  /**
   * @default "three"
   */
  title?: string;
}

/**
 * Shared example panel with a page switcher. `F3` toggles visibility.
 */
export function createExamplePane(
  options: ExamplePaneOptions = {}
): Pane {
  const { title = kDefaultTitle } = options;

  const pane = new Pane({
    title
  });
  const current = currentExample();

  const exampleBinding = pane
    .addBinding({ example: current }, "example", {
      options: kExamples,
      label: "example"
    })
    .on("change", ({ value }) => {
      if (value !== current) {
        window.location.assign(value);
      }
    });
  exampleBinding.element.classList.add(kExamplePinClass);

  document.addEventListener("keydown", (event) => {
    if (event.key !== kToggleKey) {
      return;
    }

    event.preventDefault();
    pane.hidden = !pane.hidden;
  });

  return pane;
}

// `/index.html` and `/` are the same page.
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
 * Binds the named fields of `state` as read-only rows.
 * Tweakpane's polling ticker is left off (`interval: 0`): the caller decides
 * when the values are fresh and calls `folder.refresh()`.
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
