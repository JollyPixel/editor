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

export const VECTOR2_XZ_EXAMPLE: GalleryExample = {
  id: "math/vector2-xz",
  title: "Vector2 (xz plane)",
  group: "Math",
  render(host) {
    return renderStateMatrix<Vector2>(host, {
      liveInput: true,
      create() {
        // Authored as markup, the path a Lit template takes: the pair arrives
        // as an attribute after the constructor, before the value.
        const holder = document.createElement("div");
        holder.innerHTML = `
          <jolly-vector2 label="Size" axes="xz" step="1" min="1"></jolly-vector2>
        `;

        const field = holder.querySelector("jolly-vector2")!;
        field.value = { x: 4, z: 6 };
        field.default = { x: 4, z: 6 };

        return field;
      },
      modified(field) {
        field.value = { x: 8, z: 2 };
      }
    });
  }
};
