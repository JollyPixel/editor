// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Point2d } from "../../../../src/index.ts";

export const POINT2D_EXAMPLE: GalleryExample = {
  id: "math/point2d",
  title: "Point2d",
  group: "Math",
  render(host) {
    return renderStateMatrix<Point2d>(host, {
      liveInput: true,
      create() {
        const field = document.createElement("jolly-point2d");
        field.label = "Anchor";
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
