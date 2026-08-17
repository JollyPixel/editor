// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Vector3 } from "../../../../src/index.ts";

export const VECTOR3_EXAMPLE: GalleryExample = {
  id: "math/vector3",
  title: "Vector3",
  group: "Math",
  render(host) {
    return renderStateMatrix<Vector3>(host, {
      liveInput: true,
      create() {
        const field = document.createElement("jolly-vector3");
        field.label = "Position";
        field.description = "Drag an axis's edge handle, or type 10*2";
        field.step = 0.1;
        field.value = { x: 0, y: 1, z: 0 };
        field.default = { x: 0, y: 1, z: 0 };

        return field;
      },
      modified(field) {
        field.value = { x: 3, y: 1.5, z: -2 };
      }
    });
  }
};
