// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";
import {
  folder,
  pane
} from "../shared/containerBuilders.ts";

export const REORDER_PERSIST_EXAMPLE = createSimpleExample(
  "scenarios/reorder-persist",
  "Reorder persistence",
  "Scenarios",
  () => {
    const host = pane("Reorder folders", "");
    host.reorderable = true;
    host.storageKey = "gallery-example:reorder";
    host.replaceChildren(
      folder("Transform"),
      folder("Material"),
      folder("Physics")
    );

    return host;
  }
);
