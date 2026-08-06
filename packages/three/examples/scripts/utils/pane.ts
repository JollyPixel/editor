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

  pane
    .addBinding({ example: current }, "example", {
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

// `/index.html` and `/` are the same page.
function currentExample(): string {
  const { pathname } = window.location;

  return pathname === "/index.html" ? "/" : pathname;
}
