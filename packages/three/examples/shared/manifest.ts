export interface ExampleEntry {
  label: string;
  path: string;
}

export interface ExampleGroup {
  label: string;
  examples: ExampleEntry[];
}

// CONSTANTS
export const EXAMPLE_GROUPS: ExampleGroup[] = [
  {
    label: "Components",
    examples: [
      {
        label: "Grid",
        path: "/grid/"
      },
      {
        label: "Area Box",
        path: "/area-box/"
      },
      {
        label: "Translation Controls",
        path: "/translation-controls/"
      }
    ]
  },
  {
    label: "Frustum",
    examples: [
      {
        label: "Local",
        path: "/frustum/local/"
      },
      {
        label: "Peer Sync",
        path: "/frustum/sync/"
      }
    ]
  },
  {
    label: "Mesh Highlight",
    examples: [
      {
        label: "Basic",
        path: "/mesh-highlight/basic/"
      },
      {
        label: "Peer Sync",
        path: "/mesh-highlight/peer-sync/"
      },
      {
        label: "Stress",
        path: "/mesh-highlight/stress/"
      }
    ]
  }
];

export function exampleOptions(): Record<string, string> {
  const options: Record<string, string> = { Home: "/" };
  for (const group of EXAMPLE_GROUPS) {
    for (const example of group.examples) {
      options[`${group.label}: ${example.label}`] = example.path;
    }
  }

  return options;
}
