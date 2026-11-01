// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  definePreferences,
  type PreferenceValues
} from "#src/index.ts";

// CONSTANTS
const kView = definePreferences({
  name: "view",
  label: "View",
  fields: {
    grid: {
      type: "boolean",
      label: "Grid",
      default: true
    },
    lighting: {
      type: "enum",
      label: "Lighting",
      options: [
        {
          value: "day",
          label: "Day"
        },
        {
          value: "night",
          label: "Night"
        }
      ],
      default: "day"
    },
    frame: {
      type: "chord",
      label: "Frame",
      default: []
    }
  }
});

test("values take the type of their field", () => {
  expect<PreferenceValues<typeof kView.fields>>().type.toBe<{
    readonly grid: boolean;
    readonly lighting: "day" | "night";
    readonly frame: readonly string[];
  }>();
});

test("an enum default must be one of its options", () => {
  expect(definePreferences).type.not.toBeCallableWith({
    name: "view",
    label: "View",
    fields: {
      lighting: {
        type: "enum",
        label: "Lighting",
        options: [
          {
            value: "day",
            label: "Day"
          }
        ],
        default: "dusk"
      }
    }
  });
});
