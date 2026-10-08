// Import Internal Dependencies
import "../../../../src/containers/toolbar/Toolbar.ts";
import { createSimpleExample } from "../shared/example.ts";
import { button } from "../shared/containerBuilders.ts";

export const TOOLBAR_EXAMPLE = createSimpleExample(
  () => {
    const toolbar = document.createElement("jolly-toolbar");
    toolbar.label = "Editing tools";
    toolbar.append(button("Move"), button("Rotate"), button("Scale"));

    return toolbar;
  }
);
