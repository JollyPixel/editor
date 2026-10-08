// Import Internal Dependencies
import "../../../../src/controls/Button.ts";
import "../../../../src/controls/PropertyRow.ts";
import "../../../../src/controls/Separator.ts";
import type { GalleryExample } from "../../types.ts";

// CONSTANTS
const kVariants = [
  "default",
  "accent",
  "danger"
] as const;

export const CHROME_EXAMPLE: GalleryExample = {
  render(host) {
    const root = document.createElement("div");
    root.className = "chrome-demo";

    root.append(
      section("Button variants", buttonRow()),
      section("Disabled and icon only", iconRow()),
      separator("Grouping"),
      separatorWithActions("Actions"),
      section("Property row", propertyRow())
    );

    host.append(root);
  }
};

function section(
  title: string,
  content: HTMLElement
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "state-row";
  wrapper.dataset.state = title;

  const caption = document.createElement("code");
  caption.className = "state-name";
  caption.textContent = title;

  wrapper.append(caption, content);

  return wrapper;
}

function buttonRow(): HTMLElement {
  const row = document.createElement("div");
  row.className = "chrome-row";

  for (const variant of kVariants) {
    const button = document.createElement("jolly-button");
    button.variant = variant;
    button.textContent = variant;
    row.append(button);
  }

  return row;
}

function iconRow(): HTMLElement {
  const row = document.createElement("div");
  row.className = "chrome-row";

  const withIcon = document.createElement("jolly-button");
  withIcon.icon = "search";
  withIcon.textContent = "Search";

  const iconOnly = document.createElement("jolly-button");
  iconOnly.icon = "close";
  iconOnly.label = "Close";
  iconOnly.iconOnly = true;

  const disabled = document.createElement("jolly-button");
  disabled.textContent = "Disabled";
  disabled.disabled = true;

  row.append(withIcon, iconOnly, disabled);

  return row;
}

function separator(
  label: string
): HTMLElement {
  const element = document.createElement("jolly-separator");
  element.label = label;

  return element;
}

function separatorWithActions(
  label: string
): HTMLElement {
  const element = separator(label);

  const add = document.createElement("jolly-button");
  add.slot = "actions";
  add.icon = "plus";
  add.label = "Add";
  add.iconOnly = true;

  const revert = document.createElement("jolly-button");
  revert.slot = "actions";
  revert.icon = "revert";
  revert.label = "Revert";
  revert.iconOnly = true;

  element.append(add, revert);

  return element;
}

function propertyRow(): HTMLElement {
  const row = document.createElement("jolly-property-row");
  row.label = "Export";
  row.description = "Lines up with the fields around it";

  const png = document.createElement("jolly-button");
  png.textContent = "PNG";

  const json = document.createElement("jolly-button");
  json.textContent = "JSON";

  row.append(png, json);

  return row;
}
