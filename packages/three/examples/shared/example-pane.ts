// Import Third-party Dependencies
import {
  createExamplePane as createPane,
  type Pane
} from "@jolly-pixel/ui/facade";

// Import Internal Dependencies
import { exampleOptions } from "./manifest.ts";

export interface ExamplePaneOptions {
  title?: string;
}

export function createExamplePane(
  options: ExamplePaneOptions = {}
): Pane {
  const { title = "three" } = options;

  return createPane({
    title,
    examples: exampleOptions(),
    storageKey: "three-examples"
  });
}
