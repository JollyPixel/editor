// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";
import { pane } from "../shared/containerBuilders.ts";

export const PANE_EXAMPLE = createSimpleExample(
  "containers/pane",
  "Pane",
  "Containers",
  () => pane("Inspector", "Pane content")
);
