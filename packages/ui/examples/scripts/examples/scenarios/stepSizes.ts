// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  detailOf,
  type JollyChangeDetail,
  type NumberField,
  type Slider,
  type Range
} from "../../../../src/index.ts";

// CONSTANTS
const kLabelWidth = "10ch";
const kNumberSteps = [1, 0.1, 0.01];
const kSliderSteps = [1, 0.1, 0.01];
const kRangeSteps = [1, 0.5];

/**
 * The same three controls, several `step` values apart. `step` alone governs three things at
 * once: display precision, how far one scrub pixel moves the value, and, for a track control, how
 * many stops it has to land on. Seeing that side by side is the point; a single example per
 * control only ever shows one step at a time.
 */
export const STEP_SIZES_EXAMPLE: GalleryExample = {
  id: "scenarios/step-sizes",
  title: "Step sizes",
  group: "Scenarios",
  render(host) {
    const root = document.createElement("div");
    root.className = "scenario-grid";
    root.style.setProperty("--jolly-label-width", kLabelWidth);

    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent = "step sets display precision, scrub granularity, and a track's stop count.";

    root.append(
      hint,
      buildGroup("jolly-number", kNumberSteps.map((step) => buildNumber(step))),
      buildGroup("jolly-slider", kSliderSteps.map((step) => buildSlider(step))),
      buildGroup("jolly-range", kRangeSteps.map((step) => buildRange(step)))
    );

    host.append(root);

    return () => root.remove();
  }
};

function buildGroup(
  title: string,
  fields: HTMLElement[]
): HTMLElement {
  const section = document.createElement("div");
  section.className = "state-row";

  const caption = document.createElement("code");
  caption.className = "state-name";
  caption.textContent = title;

  section.append(caption, ...fields);

  return section;
}

function buildNumber(
  step: number
): NumberField {
  const field = document.createElement("jolly-number");
  field.label = `step ${step}`;
  field.min = 0;
  field.max = 100;
  field.step = step;
  field.value = 50;

  return bind(field);
}

function buildSlider(
  step: number
): Slider {
  const field = document.createElement("jolly-slider");
  field.label = `step ${step}`;
  field.min = 0;
  field.max = 10;
  field.step = step;
  field.value = 5;

  return bind(field);
}

function buildRange(
  step: number
): Range {
  const field = document.createElement("jolly-range");
  field.label = `step ${step}`;
  field.min = 0;
  field.max = 10;
  field.step = step;
  field.value = {
    from: 2,
    to: 7
  };

  return bind(field);
}

/** The write back every consumer owes a controlled element, on both events since a drag only ever fires `jolly-input` until release. */
function bind<
  TValue,
  TField extends HTMLElement & { value: TValue; }
>(
  field: TField
): TField {
  function writeBack(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<TValue>>(event);
    if (detail !== null) {
      field.value = detail.value;
    }
  }

  field.addEventListener("jolly-input", writeBack);
  field.addEventListener("jolly-change", writeBack);

  return field;
}
