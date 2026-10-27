// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Reference } from "../../../../src/controls/Reference.ts";
import { onFieldChange } from "../../../../src/field/events.ts";

// CONSTANTS
const kAssets = new Map([
  ["forest", "forest-level"],
  ["castle", "castle-keep"],
  ["caves", "crystal-caves"]
]);
const kIds = [...kAssets.keys()];

export const REFERENCE_EXAMPLE: GalleryExample = {
  render(host) {
    return renderStateMatrix<Reference>(host, {
      create() {
        const field = document.createElement("jolly-reference");
        field.label = "Voxel map";
        field.description = "Map rendered by this actor";
        field.default = "forest";
        show(field, "forest");

        onFieldChange<string | null>(field, (value) => show(field, value));
        field.addEventListener("jolly-browse", (event) => {
          const index = kIds.indexOf(event.detail.value ?? "");
          show(field, kIds[(index + 1) % kIds.length]);
        });

        return field;
      },
      modified(field) {
        show(field, "castle");
      }
    });
  }
};

function show(
  field: Reference,
  id: string | null
): void {
  field.value = id;
  field.text = id === null ? "" : kAssets.get(id) ?? "";
}
