// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { LayerGrid } from "../../../../src/controls/LayerGrid.ts";

// CONSTANTS
const kNames = {
  0: "Default",
  1: "Player",
  2: "Terrain",
  10: "Effects"
};

export const LAYER_GRID_EXAMPLE: GalleryExample<"index"> = {
  options: [
    {
      key: "index",
      label: "Index mode"
    }
  ],
  render(host, options) {
    const initial = options.index ? 2 : 0b1000_0000_0101;

    return renderStateMatrix<LayerGrid>(host, {
      liveInput: true,
      create() {
        const field = document.createElement("jolly-layer-grid");
        field.label = options.index ? "LOD" : "Cull mask";
        field.description = options.index ?
          "Click or drag to pick one cell, arrows move the selection" :
          "Click to toggle, drag to paint, hover a named cell for its name";
        field.mode = options.index ? "index" : "mask";
        field.names = kNames;
        field.value = initial;
        field.default = initial;

        return field;
      },
      modified(field) {
        field.value = options.index ? 7 : 0b1111_0000_0000_0011;
      }
    });
  }
};
