// Import Internal Dependencies
import type { IconName } from "../../../../src/index.ts";

export interface KeyedPaneOptions {
  icon?: IconName;
  collapsible?: boolean;
}

export interface DockLayoutStage {
  layout: HTMLElementTagNameMap["jolly-dock-layout"];
  stage: HTMLElement;
  viewport: HTMLElement;
  reset: HTMLElementTagNameMap["jolly-button"];
}

export function pane(
  title: string,
  content: string
): HTMLElementTagNameMap["jolly-pane"] {
  const element = document.createElement("jolly-pane");
  element.heading = title;
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

export function placementDock(
  side: "left" | "right"
): HTMLElementTagNameMap["jolly-dock"] {
  const element = document.createElement("jolly-dock");
  element.side = side;
  element.key = side;
  element.collapsible = true;
  const resident = keyedPane(
    side,
    `${side === "left" ? "Left" : "Right"} dock`,
    "Drag or focus the separator to resize."
  );
  resident.locked = true;
  element.append(resident);

  return element;
}

export function keyedPane(
  key: string,
  title: string,
  content: string,
  options: KeyedPaneOptions = {}
): HTMLElementTagNameMap["jolly-pane"] {
  const element = pane(title, content);
  element.key = key;
  element.icon = options.icon ?? "";
  element.collapsible = options.collapsible ?? false;

  return element;
}

export function dockLayoutStage(
  storageKey: string
): DockLayoutStage {
  const stage = document.createElement("div");
  stage.className = "dock-layout-stage";

  const layout = document.createElement("jolly-dock-layout");
  layout.storageKey = storageKey;
  stage.append(layout);

  const viewport = text("Viewport");
  viewport.className = "dock-layout-viewport";

  const reset = button("Reset layout");
  reset.dataset.action = "reset-layout";
  reset.addEventListener("click", () => layout.resetLayout());

  return {
    layout,
    stage,
    viewport,
    reset
  };
}
