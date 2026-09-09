// Import Internal Dependencies
import {
  EXAMPLE_GROUPS,
  type ExampleGroup
} from "./shared/manifest.ts";

const container = document.querySelector("#examples") as HTMLElement;

container.append(
  ...EXAMPLE_GROUPS.map(createSection)
);

function createSection(
  group: ExampleGroup
): HTMLElement {
  const section = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = group.label;

  const list = document.createElement("ul");
  for (const example of group.examples) {
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
