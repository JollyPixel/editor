// Import Third-party Dependencies
import {
  createExamplePane as createPane,
  type Pane
} from "@jolly-pixel/ui/facade";

// CONSTANTS
const kExamples: Record<string, string> = {
  Inspector: "/",
  "Lag injector": "/lag.html",
  Interpolation: "/interpolation.html"
};

export interface ExamplePaneOptions {
  /**
   * @default "loop"
   */
  title?: string;
}

export function createExamplePane(
  options: ExamplePaneOptions = {}
): Pane {
  const { title = "loop" } = options;

  return createPane({
    title,
    examples: kExamples,
    storageKey: "loop-examples"
  });
}
