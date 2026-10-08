// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { SpinSlider } from "../../../../src/controls/SpinSlider.ts";

export const SPIN_SLIDER_EXAMPLE: GalleryExample = {
  render(host) {
    return renderStateMatrix<SpinSlider>(host, {
      liveInput: true,
      colored: true,
      create() {
        const field = document.createElement("jolly-spin-slider");
        field.label = "Intensity";
        field.description = "Drag to scrub, click to type, press the bar to jump";
        field.min = 0;
        field.max = 1;
        field.step = 0.01;
        field.value = 0.5;
        field.default = 0.5;

        return field;
      },
      modified(field) {
        field.value = 0.8;
      }
    });
  }
};
