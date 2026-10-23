// Import Third-party Dependencies
import { parseColor } from "@jolly-pixel/color";

// Import Internal Dependencies
import "../../../../src/controls/ColorPicker.ts";
import type { GalleryExample } from "../../types.ts";
import { readDetail } from "../../../../src/dom.ts";
import type {
  ColorPickerChannels,
  ColorPickerHarmony,
  ColorPickerLayout,
  ColorPickerSelector,
  ColorPickerSpace
} from "../../../../src/controls/ColorPicker.ts";
import type { JollyChangeDetail } from "../../../../src/field/events.ts";

interface PanelOptions {
  name: string;
  value: string;
  alpha?: boolean;
  hexInput?: boolean;
  readonly?: boolean;
  layout?: ColorPickerLayout;
  space?: ColorPickerSpace;
  selector?: ColorPickerSelector;
  channels?: ColorPickerChannels;
  harmony?: ColorPickerHarmony;
  discrete?: boolean;
  settings?: boolean;
}

// CONSTANTS
const kWideHeight = "120px";
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
  },
  {
    name: "wide",
    value: "#c39d7f",
    layout: "wide"
  },
  {
    name: "wide alpha",
    value: "#ff660080",
    alpha: true,
    layout: "wide"
  },
  {
    name: "okhsv square",
    value: "#4488ff",
    space: "okhsv"
  },
  {
    name: "wheel",
    value: "#c3567f",
    selector: "wheel",
    harmony: "triadic"
  },
  {
    name: "settings",
    value: "#6a4fd0",
    alpha: true,
    settings: true
  },
  {
    name: "okhsv discrete wheel",
    value: "#3f9d6a",
    space: "okhsv",
    selector: "wheel",
    discrete: true,
    harmony: "complementary"
  },
  {
    name: "wide okhsv wheel, oklch channels",
    value: "#c39d7f",
    alpha: true,
    layout: "wide",
    space: "okhsv",
    selector: "wheel",
    channels: "oklch",
    harmony: "analogous"
  }
];

export const COLOR_PICKER_EXAMPLE: GalleryExample = {
  render(host) {
    const root = document.createElement("div");
    root.className = "scenario-grid";

    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent =
      "Drag the square or wheel, then the hue, value or alpha track. Each panel writes its own value back, " +
      "so the readout is the committed colour.";
    root.append(hint);

    for (const options of kPanels) {
      root.append(
        buildPanel(options)
      );
    }

    host.append(root);
  }
};

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
  picker.layout = options.layout ?? "stack";
  picker.space = options.space;
  picker.selector = options.selector;
  picker.channels = options.channels;
  picker.harmony = options.harmony;
  picker.discrete = options.discrete;
  picker.settings = options.settings ?? false;
  if (picker.layout === "wide") {
    picker.style.height = kWideHeight;
  }

  const readout = document.createElement("code");
  readout.className = "state-name";
  readout.dataset.readout = options.name;
  readout.textContent = options.value;

  function writeBack(
    event: Event
  ): void {
    const detail = readDetail<JollyChangeDetail<string>>(event);
    if (detail === null) {
      return;
    }

    picker.value = detail.value;
    readout.textContent = detail.value;
    readout.style.color = swatchInk(detail.value);
  }

  picker.addEventListener(
    "jolly-input",
    writeBack
  );
  picker.addEventListener(
    "jolly-change",
    writeBack
  );

  cell.append(
    caption,
    picker,
    readout
  );

  return cell;
}

function swatchInk(
  value: string
): string {
  return parseColor(value) === null ? "" : value;
}
