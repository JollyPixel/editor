// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";
import { pane } from "../shared/containerBuilders.ts";

export const PANE_EXAMPLE = createSimpleExample(
  "containers/pane",
  "Pane",
  () => pane("Inspector", "Pane content")
);
