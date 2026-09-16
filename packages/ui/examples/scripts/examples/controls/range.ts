// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Range } from "../../../../src/index.ts";

export const RANGE_EXAMPLE: GalleryExample = {
  id: "controls/range",
  title: "Range",
  render(host) {
    return renderStateMatrix<Range>(host, {
      create() {
        const field = document.createElement("jolly-range");
        field.label = "Spawn delay";
        field.description = "Seconds, inclusive";
        field.min = 0;
        field.max = 60;
        field.step = 0.5;
        field.value = {
          from: 5,
          to: 20
        };
        field.default = {
          from: 5,
          to: 20
        };

        return field;
      },
      modified(field) {
        field.value = {
          from: 10,
          to: 45
        };
      }
    });
  }
};
