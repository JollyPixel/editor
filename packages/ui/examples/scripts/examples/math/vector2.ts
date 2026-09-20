// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Vector2 } from "../../../../src/index.ts";

// CONSTANTS
const kPlanes = {
  xy: {
    markup: `<jolly-vector2 label="UV Offset" step="0.01"></jolly-vector2>`,
    initial: { x: 0.5, y: 0.5 },
    modified: { x: 0.2, y: 0.8 }
  },
  xz: {
    markup: `<jolly-vector2 label="Size" axes="xz" step="1" min="1"></jolly-vector2>`,
    initial: { x: 4, z: 6 },
    modified: { x: 8, z: 2 }
  }
};

export const VECTOR2_EXAMPLE: GalleryExample<"xz"> = {
  id: "math/vector2",
  title: "Vector2",
  options: [
    {
      key: "xz",
      label: "XZ plane"
    }
  ],
  render(host, options) {
    const plane = options.xz ? kPlanes.xz : kPlanes.xy;

    return renderStateMatrix<Vector2>(host, {
      liveInput: true,
      create() {
        /*
         * Authored as markup, the path a Lit template takes: the pair arrives
         * as an attribute after the constructor, before the value.
         */
        const holder = document.createElement("div");
        holder.innerHTML = plane.markup;

        const field = holder.querySelector("jolly-vector2")!;
        field.value = { ...plane.initial };
        field.default = { ...plane.initial };

        return field;
      },
      modified(field) {
        field.value = { ...plane.modified };
      }
    });
  }
};
