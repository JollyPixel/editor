// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Flags } from "../../../../src/index.ts";

// CONSTANTS
const kCollisionLayers = [
  {
    value: 1,
    label: "Default"
  },
  {
    value: 2,
    label: "Player"
  },
  {
    value: 4,
    label: "Terrain"
  },
  {
    value: 8,
    label: "Trigger"
  }
];

export const FLAGS_EXAMPLE: GalleryExample = {
  id: "controls/flags",
  title: "Flags",
  group: "Controls",
  render(host) {
    return renderStateMatrix<Flags>(host, {
      colored: true,
      create() {
        const field = document.createElement("jolly-flags");
        field.label = "Collides with";
        field.options = kCollisionLayers;
        field.value = 0b0101;
        field.default = 0b0101;

        return field;
      },
      modified(field) {
        field.value = 0b1010;
      }
    });
  }
};
