export function pane(
  title: string,
  content: string
): HTMLElementTagNameMap["jolly-pane"] {
  const element = document.createElement("jolly-pane");
  element.title = title;
  if (content !== "") {
    element.append(text(content));
  }

  return element;
}

export function folder(
  label: string
): HTMLElementTagNameMap["jolly-folder"] {
  const element = document.createElement("jolly-folder");
  element.label = label;
  element.append(text(`${label} content`));

  return element;
}

export function tabs(): HTMLElementTagNameMap["jolly-tabs"] {
  const element = document.createElement("jolly-tabs");
  element.id = "container-example-tabs";
  element.append(
    tab("build", "Build"),
    tab("paint", "Paint"),
    tab("disabled", "Disabled", true)
  );

  return element;
}

export function dock(
  side: "left" | "right",
  title: string
): HTMLElementTagNameMap["jolly-dock"] {
  const element = document.createElement("jolly-dock");
  element.side = side;
  element.collapsible = true;
  element.storageKey = `gallery-example:dock:${side}:${title}`;
  element.append(pane(title, "Drag or focus the separator to resize."));

  return element;
}

export function button(
  label: string,
  variant: "default" | "accent" | "danger" = "default"
): HTMLElementTagNameMap["jolly-button"] {
  const element = document.createElement("jolly-button");
  element.variant = variant;
  element.textContent = label;

  return element;
}

export function text(
  value: string
): HTMLParagraphElement {
  const element = document.createElement("p");
  element.textContent = value;

  return element;
}

/**
 * A dock for placement scenarios. Its layout owns persistence, so the dock
 * deliberately has no storage key of its own.
 */
export function placementDock(
  side: "left" | "right"
): HTMLElementTagNameMap["jolly-dock"] {
  const element = document.createElement("jolly-dock");
  element.side = side;
  element.key = side;
  element.collapsible = true;
  const resident = placementPane(
    side,
    `${side === "left" ? "Left" : "Right"} dock`,
    "Drag or focus the separator to resize."
  );
  resident.locked = true;
  element.append(resident);

  return element;
}

export function placementPane(
  key: string,
  title: string,
  content: string
): HTMLElementTagNameMap["jolly-pane"] {
  const element = pane(title, content);
  element.key = key;

  return element;
}

function tab(
  value: string,
  label: string,
  disabled = false
): HTMLElementTagNameMap["jolly-tab"] {
  const element = document.createElement("jolly-tab");
  element.value = value;
  element.label = label;
  element.disabled = disabled;
  element.append(text(`${label} panel`));

  return element;
}
