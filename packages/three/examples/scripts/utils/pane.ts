// Import Third-party Dependencies
import { Pane } from "tweakpane";

// CONSTANTS
const kDefaultTitle = "three";
const kToggleKey = "F3";
/** Label → path, as consumed by the switcher's `options`. */
const kExamples: Record<string, string> = {
  Grid: "/"
};

export interface ExamplePaneOptions {
  /**
   * @default "three"
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
