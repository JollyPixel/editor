// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";
import { button } from "../shared/containerBuilders.ts";

export const TOOLBAR_EXAMPLE = createSimpleExample(
  "containers/toolbar",
  "Toolbar",
  "Containers",
  () => {
    const toolbar = document.createElement("jolly-toolbar");
    toolbar.label = "Editing tools";
    toolbar.append(button("Move"), button("Rotate"), button("Scale"));

    return toolbar;
  }
);
