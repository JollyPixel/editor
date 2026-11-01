// Import Third-party Dependencies
import {
  COLOR_PICKER_DEFAULTS,
  COLOR_PICKER_OPTIONS
} from "@jolly-pixel/ui/color-picker";
import { definePreferences } from "@jolly-pixel/preferences";

export const RUNTIME_PREFERENCES = definePreferences({
  name: "runtime",
  label: "Viewport overlays",
  fields: {
    stats: {
      type: "boolean",
      label: "Performance HUD",
      group: "Viewport overlays",
      description: "Frame rate and draw calls in a corner of 3D viewports",
      default: true
    },
    viewHelper: {
      type: "boolean",
      label: "Axis gizmo",
      group: "Viewport overlays",
      default: true
    },
    metrics: {
      type: "boolean",
      label: "Performance pane",
      group: "Viewport overlays",
      description: "The floating pane with frame time graphs",
      default: false
    }
  }
});

export const LANTERN_PREFERENCES = definePreferences({
  name: "lantern",
  label: "Tours",
  fields: {
    seen: {
      type: "entries",
      label: "Finished tours",
      group: "Tours",
      description: "Clearing it offers each tour again",
      default: {}
    }
  }
});

export const CAMERA_PREFERENCES = definePreferences({
  name: "camera",
  label: "Camera",
  fields: {
    lookSensitivity: {
      type: "range",
      label: "Look sensitivity",
      group: "Look",
      description: "How fast a drag or a touchpad swipe turns the camera",
      min: 0.25,
      max: 4,
      step: 0.25,
      default: 1
    },
    invertY: {
      type: "boolean",
      label: "Invert vertical look",
      group: "Look",
      default: false
    },
    touchpadSwipe: {
      type: "enum",
      label: "Two-finger swipe",
      group: "Look",
      description: "While orbiting a pivot, a swipe always orbits",
      options: [
        {
          value: "look",
          label: "Looks around"
        },
        {
          value: "pan",
          label: "Pans"
        }
      ],
      default: "look"
    },
    flySpeed: {
      type: "range",
      label: "Fly speed",
      group: "Fly",
      description: "Scales each editor's starting speed; the wheel still changes it",
      min: 0.25,
      max: 4,
      step: 0.25,
      default: 1
    },
    forward: {
      type: "key",
      label: "Forward",
      group: "Fly",
      default: ["KeyW", "ArrowUp"]
    },
    back: {
      type: "key",
      label: "Back",
      group: "Fly",
      default: ["KeyS", "ArrowDown"]
    },
    left: {
      type: "key",
      label: "Left",
      group: "Fly",
      default: ["KeyA", "ArrowLeft"]
    },
    right: {
      type: "key",
      label: "Right",
      group: "Fly",
      default: ["KeyD", "ArrowRight"]
    },
    up: {
      type: "key",
      label: "Up",
      group: "Fly",
      default: ["Space"]
    },
    down: {
      type: "key",
      label: "Down",
      group: "Fly",
      default: ["ShiftLeft", "ShiftRight"]
    },
    lookUp: {
      type: "key",
      label: "Look up",
      group: "Look",
      default: ["KeyI"]
    },
    lookDown: {
      type: "key",
      label: "Look down",
      group: "Look",
      default: ["KeyK"]
    },
    lookLeft: {
      type: "key",
      label: "Look left",
      group: "Look",
      default: ["KeyJ"]
    },
    lookRight: {
      type: "key",
      label: "Look right",
      group: "Look",
      default: ["KeyL"]
    }
  }
});

export const COLOR_PICKER_PREFERENCES = definePreferences({
  name: "color-picker",
  label: "Color picker",
  fields: {
    space: {
      type: "enum",
      label: "Color space",
      group: "Picker",
      description: "OKHSV keeps hue and lightness steps perceptually even",
      options: COLOR_PICKER_OPTIONS.space,
      default: COLOR_PICKER_DEFAULTS.space
    },
    selector: {
      type: "enum",
      label: "Selector",
      group: "Picker",
      options: COLOR_PICKER_OPTIONS.selector,
      default: COLOR_PICKER_DEFAULTS.selector
    },
    channels: {
      type: "enum",
      label: "Channel fields",
      group: "Picker",
      description: "The fields next to RGB in docked pickers",
      options: COLOR_PICKER_OPTIONS.channels,
      default: COLOR_PICKER_DEFAULTS.channels
    },
    harmony: {
      type: "enum",
      label: "Harmony",
      group: "Harmony",
      description: "Swatches for a color scheme built from the current color",
      options: COLOR_PICKER_OPTIONS.harmony,
      default: COLOR_PICKER_DEFAULTS.harmony
    },
    discrete: {
      type: "boolean",
      label: "Discrete wheel",
      group: "Picker",
      description: "Snaps the wheel to hue sectors and saturation rings",
      default: COLOR_PICKER_DEFAULTS.discrete
    }
  }
});

export const HOST_PREFERENCES = [
  RUNTIME_PREFERENCES,
  LANTERN_PREFERENCES,
  CAMERA_PREFERENCES,
  COLOR_PICKER_PREFERENCES
] as const;
