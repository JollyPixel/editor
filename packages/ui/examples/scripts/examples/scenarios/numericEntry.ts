// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  detailOf,
  NumberField,
  type JollyChangeDetail
} from "../../../../src/index.ts";

// CONSTANTS
const kSuggestions = [
  "1920/2",
  "100*1.5",
  "(3+4)/2",
  "1,5",
  "1e3",
  "1/0"
];

/**
 * The two numeric affordances together, with a live log of what each one commits. Expressions and
 * drag scrub share a field here on purpose: the log is what shows that typing stays silent until
 * commit while a scrub streams.
 */
export const NUMERIC_ENTRY_EXAMPLE: GalleryExample = {
  id: "scenarios/numeric-entry",
  title: "Expressions and scrub",
  group: "Scenarios",
  render(host) {
    const root = document.createElement("div");
    root.className = "scenario-grid";

    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent = `Drag the handle on the input's left edge, or type: ${kSuggestions.join(", ")}`;

    const field = document.createElement("jolly-number");
    field.label = "Width";
    field.description = "Shift coarsens the scrub, Alt refines it";
    field.step = 1;
    field.min = 0;
    field.max = 4096;
    field.value = 960;
    field.default = 960;

    const log = document.createElement("ol");
    log.className = "scenario-log";

    field.addEventListener("jolly-input", (event) => {
      append(log, "input", event, field);
    });
    field.addEventListener("jolly-change", (event) => {
      append(log, "change", event, field);
    });

    root.append(hint, field, log);
    host.append(root);

    return () => root.remove();
  }
};

function append(
  log: HTMLElement,
  kind: string,
  event: Event,
  field: NumberField
): void {
  const detail = detailOf<JollyChangeDetail<number>>(event);
  if (detail === null) {
    return;
  }

  // The write back a controlled element needs. Without it the field snaps back.
  field.value = detail.value;

  const entry = document.createElement("li");
  entry.dataset.kind = kind;
  entry.textContent = `${kind}: ${detail.value}`;
  log.prepend(entry);

  while (log.childElementCount > 12) {
    log.lastElementChild?.remove();
  }
}
