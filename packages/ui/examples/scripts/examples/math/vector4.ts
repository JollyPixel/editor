// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Vector4 } from "../../../../src/math/Vector4.ts";
import {
  AXIS_STYLE_OPTIONS,
  axisStyleOf,
  type AxisStyleOptionKey
} from "./axisStyle.ts";

export const VECTOR4_EXAMPLE: GalleryExample<AxisStyleOptionKey> = {
  options: AXIS_STYLE_OPTIONS,
  render(host, options) {
    return renderStateMatrix<Vector4>(host, {
      liveInput: true,
      create() {
        const field = document.createElement("jolly-vector4");
        field.axisStyle = axisStyleOf(options);
        field.label = "Bounds";
        field.step = 1;
        field.value = {
          x: 0,
          y: 0,
          z: 128,
          w: 128
        };
        field.default = {
          x: 0,
          y: 0,
          z: 128,
          w: 128
        };

        return field;
      },
      modified(field) {
        field.value = {
          x: 4,
          y: 4,
          z: 96,
          w: 96
        };
      }
    });
  }
};
