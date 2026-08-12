// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";
import { dock } from "../shared/containerBuilders.ts";

export const DOCK_EXAMPLE = createSimpleExample(
  "containers/dock",
  "Dock",
  "Containers",
  () => {
    const element = dock("right", "Layers");
    element.style.marginInlineStart = "auto";

    return element;
  }
);
