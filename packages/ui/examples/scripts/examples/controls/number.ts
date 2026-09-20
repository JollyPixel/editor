// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import {
  detailOf,
  NumberField,
  type JollyChangeDetail
} from "../../../../src/index.ts";

// CONSTANTS
const kLogLength = 12;

export const NUMBER_EXAMPLE: GalleryExample<"eventLog"> = {
  id: "controls/number",
  title: "Number",
  options: [
    {
      key: "eventLog",
      label: "Event log"
    }
  ],
  render(host, options) {
    const root = document.createElement("div");
    root.className = "scenario-grid";
    if (options.eventLog) {
      root.append(buildEventLog(root));
    }
    host.append(root);

    return renderStateMatrix<NumberField>(root, {
      liveInput: true,
      create() {
        const field = document.createElement("jolly-number");
        field.label = "Opacity";
        field.description = "Drag the input's edge handle, or type 1920/2";
        field.step = 0.01;
        field.min = 0;
        field.max = 1;
        field.value = 0.5;
        field.default = 0.5;

        return field;
      },
      modified(field) {
        field.value = 0.75;
      }
    });
  }
};

function buildEventLog(
  source: HTMLElement
): HTMLElement {
  const log = document.createElement("ol");
  log.className = "scenario-log";

  for (const kind of ["input", "change"]) {
    source.addEventListener(`jolly-${kind}`, (event) => {
      const detail = detailOf<JollyChangeDetail<number>>(event);
      if (detail === null) {
        return;
      }

      const entry = document.createElement("li");
      entry.dataset.kind = kind;
      entry.textContent = `${kind}: ${detail.value}`;
      log.prepend(entry);

      while (log.childElementCount > kLogLength) {
        log.lastElementChild?.remove();
      }
    });
  }

  return log;
}
