// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Quaternion } from "../../../../src/index.ts";

export const QUATERNION_EXAMPLE: GalleryExample = {
  id: "math/quaternion",
  title: "Quaternion",
  group: "Math",
  render(host) {
    return renderStateMatrix<Quaternion>(host, {
      liveInput: true,
      create() {
        const field = document.createElement("jolly-quaternion");
        field.label = "Rotation";
        field.description = "Edited as Euler angles, in degrees";
        field.value = {
          x: 0,
          y: 0,
          z: 0,
          w: 1
        };
        field.default = {
          x: 0,
          y: 0,
          z: 0,
          w: 1
        };

        return field;
      },
      modified(field) {
        // 45 degrees about Y.
        field.value = {
          x: 0,
          y: 0.3826834323650898,
          z: 0,
          w: 0.9238795325112867
        };
      }
    });
  }
};
