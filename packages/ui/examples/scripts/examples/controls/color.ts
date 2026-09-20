// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Color } from "../../../../src/index.ts";

export const COLOR_EXAMPLE: GalleryExample<"alpha"> = {
  id: "controls/color",
  title: "Color",
  options: [
    {
      key: "alpha",
      label: "Alpha"
    }
  ],
  render(host, options) {
    const initial = options.alpha ? "#4488ffcc" : "#4488ff";

    return renderStateMatrix<Color>(host, {
      create() {
        const field = document.createElement("jolly-color");
        field.label = "Tint";
        field.description = options.alpha ?
          "Eight digit values carry alpha" :
          "Accepts #f60 or ff6600";
        field.alpha = options.alpha;
        field.value = initial;
        field.default = initial;

        return field;
      },
      modified(field) {
        field.value = options.alpha ? "#ff660080" : "#ff6600";
      },
      // Keep the swatch synced while the popup streams drag input.
      liveInput: true
    });
  }
};
