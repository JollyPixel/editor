// Import Internal Dependencies
import type { DeclaredLayout } from "../../src/containers/dock/layout.ts";

export const DECLARED_LAYOUT: DeclaredLayout = {
  docks: [
    {
      key: "left",
      groups: [
        {
          panes: ["hierarchy"]
        }
      ]
    },
    {
      key: "right",
      groups: [
        {
          panes: ["inspector"]
        },
        {
          panes: ["layers"]
        }
      ]
    }
  ],
  floating: [],
  locked: []
};

export const GROUPED_LAYOUT: DeclaredLayout = {
  docks: [
    {
      key: "left",
      groups: [
        {
          panes: ["general", "blocks", "paint"],
          active: "blocks"
        },
        {
          panes: ["layers"]
        }
      ]
    },
    {
      key: "right",
      groups: []
    }
  ],
  floating: [],
  locked: []
};
