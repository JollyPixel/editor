// Import Internal Dependencies
import type { GalleryEntry } from "../../types.ts";

export const CONTROLS_EXAMPLES: readonly GalleryEntry[] = [
  {
    id: "controls/text",
    title: "Text",
    load: async() => (await import("./text.ts")).TEXT_EXAMPLE
  },
  {
    id: "controls/number",
    title: "Number",
    load: async() => (await import("./number.ts")).NUMBER_EXAMPLE
  },
  {
    id: "controls/checkbox",
    title: "Checkbox",
    load: async() => (await import("./checkbox.ts")).CHECKBOX_EXAMPLE
  },
  {
    id: "controls/slider",
    title: "Slider",
    load: async() => (await import("./slider.ts")).SLIDER_EXAMPLE
  },
  {
    id: "controls/spin-slider",
    title: "Spin slider",
    load: async() => (await import("./spinSlider.ts")).SPIN_SLIDER_EXAMPLE
  },
  {
    id: "controls/range",
    title: "Range",
    load: async() => (await import("./range.ts")).RANGE_EXAMPLE
  },
  {
    id: "controls/flags",
    title: "Flags",
    load: async() => (await import("./flags.ts")).FLAGS_EXAMPLE
  },
  {
    id: "controls/select",
    title: "Select",
    load: async() => (await import("./select.ts")).SELECT_EXAMPLE
  },
  {
    id: "controls/color",
    title: "Color",
    load: async() => (await import("./color.ts")).COLOR_EXAMPLE
  },
  {
    id: "controls/color-picker",
    title: "Color picker",
    load: async() => (await import("./colorPicker.ts")).COLOR_PICKER_EXAMPLE
  },
  {
    id: "controls/button-group",
    title: "Button group",
    load: async() => (await import("./buttonGroup.ts")).BUTTON_GROUP_EXAMPLE
  },
  {
    id: "controls/scene-controls",
    title: "Scene controls",
    load: async() => (await import("./controls.ts")).SCENE_CONTROLS_EXAMPLE
  },
  {
    id: "controls/chrome",
    title: "Button, separator, row",
    load: async() => (await import("./chrome.ts")).CHROME_EXAMPLE
  },
  {
    id: "controls/tool-button",
    title: "Tool button",
    load: async() => (await import("./toolButton.ts")).TOOL_BUTTON_EXAMPLE
  }
];
