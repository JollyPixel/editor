// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Color } from "../../../../src/index.ts";

export const COLOR_EXAMPLE: GalleryExample = {
  id: "controls/color",
  title: "Color",
  group: "Controls",
  render(host) {
    return renderStateMatrix<Color>(host, {
      create() {
        const field = document.createElement("jolly-color");
        field.label = "Tint";
        field.description = "Accepts #f60 or ff6600";
        field.value = "#4488ff";
        field.default = "#4488ff";

        return field;
      },
      modified(field) {
        field.value = "#ff6600";
      },
      // Keep the swatch synced while the popup streams drag input.
      liveInput: true
    });
  }
};

export const COLOR_ALPHA_EXAMPLE: GalleryExample = {
  id: "controls/color-alpha",
  title: "Color (alpha)",
  group: "Controls",
  render(host) {
    return renderStateMatrix<Color>(host, {
      create() {
        const field = document.createElement("jolly-color");
        field.label = "Tint";
        field.description = "Eight digit values carry alpha";
        field.alpha = true;
        field.value = "#4488ffcc";
        field.default = "#4488ffcc";

        return field;
      },
      modified(field) {
        field.value = "#ff660080";
      },
      liveInput: true
    });
  }
};
