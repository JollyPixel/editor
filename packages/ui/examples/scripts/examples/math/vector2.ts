// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Vector2 } from "../../../../src/index.ts";

export const VECTOR2_EXAMPLE: GalleryExample = {
  id: "math/vector2",
  title: "Vector2",
  group: "Math",
  render(host) {
    return renderStateMatrix<Vector2>(host, {
      liveInput: true,
      create() {
        const field = document.createElement("jolly-vector2");
        field.label = "UV Offset";
        field.step = 0.01;
        field.value = { x: 0.5, y: 0.5 };
        field.default = { x: 0.5, y: 0.5 };

        return field;
      },
      modified(field) {
        field.value = { x: 0.2, y: 0.8 };
      }
    });
  }
};
