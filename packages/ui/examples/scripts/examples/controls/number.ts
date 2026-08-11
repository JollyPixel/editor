// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { NumberField } from "../../../../src/index.ts";

export const NUMBER_EXAMPLE: GalleryExample = {
  id: "controls/number",
  title: "Number",
  group: "Controls",
  render(host) {
    return renderStateMatrix<NumberField>(host, {
      liveInput: true,
      create() {
        const field = document.createElement("jolly-number");
        field.label = "Opacity";
        field.description = "Drag the input's edge handle, or type 1920/2";
        field.step = 0.01;
        field.min = 0;
        field.max = 1;
        field.value = 0.5;
        field.default = 0.5;

        return field;
      },
      modified(field) {
        field.value = 0.75;
      }
    });
  }
};
