// Import Internal Dependencies
import {
  showConfirm,
  showPrompt
} from "../../../src/index.ts";
import type { GalleryExample } from "../types.ts";

export const PANE_EXAMPLE = simpleExample(
  "containers/pane",
  "Pane",
  () => pane("Inspector", "Pane content")
);

export const FOLDER_EXAMPLE = simpleExample(
  "containers/folder",
  "Folder",
  () => {
    const folder = document.createElement("jolly-folder");
    folder.label = "Transform";
    folder.append(text("Position, rotation, and scale controls belong here."));

    return folder;
  }
);

export const TABS_EXAMPLE = simpleExample(
  "containers/tabs",
  "Tabs",
  tabs
);

export const TAB_EXAMPLE = simpleExample(
  "containers/tab",
  "Tab",
  tabs
);

export const DOCK_EXAMPLE = simpleExample(
  "containers/dock",
  "Dock",
  () => {
    const element = dock("right", "Layers");
    element.style.marginInlineStart = "auto";

    return element;
  }
);

export const FLOATING_EXAMPLE = simpleExample(
  "containers/floating",
  "Floating",
  () => {
    const floating = document.createElement("jolly-floating");
    floating.x = 280;
    floating.y = 48;
    floating.storageKey = "gallery-example:floating";
    floating.append(pane("Floating", "Drag the title or resize the right and bottom edges."));

    return floating;
  }
);

export const DIALOG_EXAMPLE: GalleryExample = {
  id: "containers/dialog",
  title: "Dialog",
  group: "Containers",
  render(host) {
    const root = document.createElement("div");
    root.className = "chrome-row";
    const open = button("Open dialog", "accent");
    const dialog = document.createElement("jolly-dialog");
    dialog.title = "Delete layer?";
    dialog.append(text("This declarative dialog can contain arbitrary content."));
    const close = button("Close", "accent");
    close.slot = "actions";
    close.addEventListener("click", () => dialog.close());
    dialog.append(close);
    open.addEventListener("click", () => void dialog.showModal());
    const confirm = button("Show confirm helper");
    confirm.dataset.action = "confirm-helper";
    confirm.addEventListener("click", async() => {
      root.dataset.result = String(await showConfirm({
        title: "Confirm helper",
        message: "Continue?"
      }));
    });
    const prompt = button("Show prompt helper");
    prompt.dataset.action = "prompt-helper";
    prompt.addEventListener("click", async() => {
      root.dataset.result = String(await showPrompt({
        title: "Prompt helper",
        label: "Name"
      }));
    });
    root.append(open, confirm, prompt, dialog);
    host.append(root);

    return () => root.remove();
  }
};

export const TOOLBAR_EXAMPLE = simpleExample(
  "containers/toolbar",
  "Toolbar",
  () => {
    const toolbar = document.createElement("jolly-toolbar");
    toolbar.label = "Editing tools";
    toolbar.append(button("Move"), button("Rotate"), button("Scale"));

    return toolbar;
  }
);

export const RAIL_EXAMPLE = simpleExample(
  "containers/rail",
  "Rail",
  () => {
    const root = document.createElement("div");
    root.className = "chrome-demo";
    const verticalLabel = text("Vertical");
    verticalLabel.className = "scenario-hint";
    const vertical = document.createElement("jolly-rail");
    vertical.append(button("M"), button("R"), button("S"));
    const horizontalLabel = text("Horizontal");
    horizontalLabel.className = "scenario-hint";
    const horizontal = document.createElement("jolly-rail");
    horizontal.orientation = "horizontal";
    horizontal.append(button("M"), button("R"), button("S"));
    root.append(
      verticalLabel,
      vertical,
      horizontalLabel,
      horizontal
    );

    return root;
  }
);

export const REORDER_PERSIST_EXAMPLE = simpleExample(
  "scenarios/reorder-persist",
  "Reorder persistence",
  () => {
    const host = pane("Reorder folders", "");
    host.reorderable = true;
    host.storageKey = "gallery-example:reorder";
    host.replaceChildren(
      folder("Transform"),
      folder("Material"),
      folder("Physics")
    );

    return host;
  }
);

export const DOCK_RESIZE_EXAMPLE: GalleryExample = {
  id: "scenarios/dock-resize",
  title: "Dock and floating placement",
  group: "Scenarios",
  render(host) {
    const stage = document.createElement("div");
    stage.className = "placement-stage";
    const left = dock("left", "Left dock");
    const right = dock("right", "Right dock");
    const floating = document.createElement("jolly-floating");
    floating.x = 320;
    floating.y = 120;
    floating.width = 280;
    floating.height = 220;
    floating.storageKey = "gallery-example:placement-floating";
    floating.append(pane("Floating pane", "Move and resize me."));
    stage.append(left, text("Viewport content"), right, floating);
    host.append(stage);

    return () => stage.remove();
  }
};

export const DIALOG_ESCAPE_EXAMPLE = simpleExample(
  "scenarios/dialog-escape",
  "Dialog Escape",
  () => {
    const root = document.createElement("div");
    root.className = "chrome-row";
    const dialog = document.createElement("jolly-dialog");
    dialog.title = "Press Escape";
    dialog.append(text("Escape follows the native dialog cancellation path."));
    const open = button("Open dismissible dialog");
    open.addEventListener("click", () => void dialog.showModal());
    root.append(open, dialog);

    return root;
  }
);

function simpleExample(
  id: string,
  title: string,
  build: () => HTMLElement
): GalleryExample {
  return {
    id,
    title,
    group: id.startsWith("containers/") ? "Containers" : "Scenarios",
    render(host) {
      const element = build();
      host.append(element);

      return () => element.remove();
    }
  };
}

function pane(
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

function folder(
  label: string
): HTMLElementTagNameMap["jolly-folder"] {
  const element = document.createElement("jolly-folder");
  element.label = label;
  element.append(text(`${label} content`));

  return element;
}

function tabs(): HTMLElementTagNameMap["jolly-tabs"] {
  const element = document.createElement("jolly-tabs");
  element.id = "container-example-tabs";
  element.append(
    tab("build", "Build"),
    tab("paint", "Paint"),
    tab("disabled", "Disabled", true)
  );

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

function dock(
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

function button(
  label: string,
  variant: "default" | "accent" | "danger" = "default"
): HTMLElementTagNameMap["jolly-button"] {
  const element = document.createElement("jolly-button");
  element.variant = variant;
  element.textContent = label;

  return element;
}

function text(
  value: string
): HTMLParagraphElement {
  const element = document.createElement("p");
  element.textContent = value;

  return element;
}
