// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  detailOf,
  parseColor,
  type JollyChangeDetail
} from "../../../../src/index.ts";

interface PanelOptions {
  name: string;
  value: string;
  alpha?: boolean;
  hexInput?: boolean;
  readonly?: boolean;
}

// CONSTANTS
const kPanels: PanelOptions[] = [
  {
    name: "default",
    value: "#4488ff"
  },
  {
    name: "alpha",
    value: "#ff660080",
    alpha: true
  },
  {
    name: "no hex field",
    value: "#22aa66",
    hexInput: false
  },
  {
    name: "readonly",
    value: "#aa2255",
    readonly: true
  }
];

/**
 * Shows the picker states that apply outside a field row.
 */
export const COLOR_PICKER_EXAMPLE: GalleryExample = {
  id: "controls/color-picker",
  title: "Color picker",
  group: "Controls",
  render(host) {
    const root = document.createElement("div");
    root.className = "scenario-grid";

    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent =
      "Drag the square, hue or alpha track. Each panel writes its own value back, " +
      "so the readout is the committed colour.";
    root.append(hint);

    for (const options of kPanels) {
      root.append(
        buildPanel(options)
      );
    }

    host.append(root);

    return () => root.remove();
  }
};

/**
 * Appends panels to the gallery scope. A nested scope would reset
 * `color-scheme` to the system preference.
 */
function buildPanel(
  options: PanelOptions
): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "state-row";

  const caption = document.createElement("code");
  caption.className = "state-name";
  caption.textContent = options.name;

  const picker = document.createElement("jolly-color-picker");
  picker.value = options.value;
  picker.alpha = options.alpha ?? false;
  picker.hexInput = options.hexInput ?? true;
  picker.readonly = options.readonly ?? false;

  const readout = document.createElement("code");
  readout.className = "state-name";
  readout.dataset.readout = options.name;
  readout.textContent = options.value;

  // Controlled pickers require write-back during drag input.
  function writeBack(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<string>>(event);
    if (detail === null) {
      return;
    }

    picker.value = detail.value;
    readout.textContent = detail.value;
    readout.style.color = swatchInk(detail.value);
  }

  picker.addEventListener("jolly-input", writeBack);
  picker.addEventListener("jolly-change", writeBack);

  cell.append(
    caption,
    picker,
    readout
  );

  return cell;
}

/**
 * Tints the readout to verify that emitted values are valid CSS.
 */
function swatchInk(
  value: string
): string {
  return parseColor(value) === null ? "" : value;
}
