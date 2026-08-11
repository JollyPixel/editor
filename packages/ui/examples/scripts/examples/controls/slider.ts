// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Slider } from "../../../../src/index.ts";

export const SLIDER_EXAMPLE: GalleryExample = {
  id: "controls/slider",
  title: "Slider",
  group: "Controls",
  render(host) {
    return renderStateMatrix<Slider>(host, {
      liveInput: true,
      colored: true,
      create() {
        const field = document.createElement("jolly-slider");
        field.label = "Roughness";
        field.min = 0;
        field.max = 1;
        field.step = 0.05;
        field.value = 0.4;
        field.default = 0.4;

        return field;
      },
      modified(field) {
        field.value = 0.8;
      }
    });
  }
};
