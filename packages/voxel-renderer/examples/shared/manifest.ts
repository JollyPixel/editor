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
    label: "Rendering",
    examples: [
      {
        label: "Block Shapes",
        path: "/shapes/"
      },
      {
        label: "Blockset UV",
        path: "/blockset/"
      },
      {
        label: "Transparency & Light",
        path: "/transparency/"
      },
      {
        label: "Normal Map",
        path: "/normal-map/"
      }
    ]
  },
  {
    label: "Engine",
    examples: [
      {
        label: "Physics",
        path: "/physics/"
      },
      {
        label: "Noise World",
        path: "/noise-world/"
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
