// Import Internal Dependencies
import {
  EXAMPLES,
  EXAMPLE_GROUPS,
  type ExampleEntry
} from "./shared/manifest.ts";

const container = document.querySelector("#examples") as HTMLElement;

container.append(
  createSection("Components", EXAMPLES),
  ...EXAMPLE_GROUPS.map(
    (group) => createSection(group.label, group.examples)
  )
);

function createSection(
  label: string,
  examples: ExampleEntry[]
): HTMLElement {
  const section = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = label;

  const list = document.createElement("ul");
  for (const example of examples) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = example.path;
    link.textContent = example.label;

    const path = document.createElement("span");
    path.textContent = example.path;
    link.append(path);

    item.append(link);
    list.append(item);
  }
  section.append(heading, list);

  return section;
}
