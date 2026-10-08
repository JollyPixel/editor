// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Text } from "../../../../src/controls/Text.ts";

export const TEXT_EXAMPLE: GalleryExample = {
  render(host) {
    return renderStateMatrix<Text>(host, {
      create() {
        const field = document.createElement("jolly-text");
        field.label = "Layer name";
        field.description = "Shown in the layer list";
        field.value = "Background";
        field.default = "Background";
        field.placeholder = "Untitled";

        return field;
      },
      modified(field) {
        field.value = "Foreground";
      }
    });
  }
};
