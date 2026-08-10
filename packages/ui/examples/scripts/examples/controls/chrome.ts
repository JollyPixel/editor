// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import "../../../../src/index.ts";

// CONSTANTS
const kVariants = [
  "default",
  "accent",
  "danger"
] as const;

/**
 * The three elements that are not fields. They have no value, so the state matrix does not apply:
 * there is nothing to be mixed, modified or reverted.
 */
export const CHROME_EXAMPLE: GalleryExample = {
  id: "controls/chrome",
  title: "Button, separator, row",
  group: "Controls",
  render(host) {
    const root = document.createElement("div");
    root.className = "chrome-demo";

    root.append(
      section("Button variants", buttonRow()),
      section("Disabled and icon only", iconRow()),
      separator("Grouping"),
      section("Property row", propertyRow())
    );

    host.append(root);

    return () => root.remove();
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
