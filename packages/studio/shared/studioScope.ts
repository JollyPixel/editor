// Import Third-party Dependencies
import { definePreferences } from "@jolly-pixel/preferences";

export const STUDIO_PREFERENCES = definePreferences({
  name: "studio",
  label: "Appearance",
  fields: {
    theme: {
      type: "enum",
      label: "Theme",
      group: "Theme",
      options: [
        {
          value: "auto",
          label: "System"
        },
        {
          value: "light",
          label: "Light"
        },
        {
          value: "dark",
          label: "Dark"
        }
      ],
      default: "auto"
    },
    density: {
      type: "enum",
      label: "Density",
      group: "Theme",
      options: [
        {
          value: "compact",
          label: "Compact"
        },
        {
          value: "default",
          label: "Default"
        },
        {
          value: "comfortable",
          label: "Comfortable"
        }
      ],
      default: "default"
    },
    prefetchEditors: {
      type: "boolean",
      label: "Prefetch editors",
      group: "Loading",
      description: "Downloads every editor while the studio is idle, so the first tab of each opens faster",
      default: true
    }
  }
});
