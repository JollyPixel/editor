// Import Internal Dependencies
import {
  Mixed,
  peerColor,
  detailOf,
  showConfirm,
  type CollaboratorPresence,
  type FieldValue
} from "../../../../src/index.ts";
import type { GalleryExample } from "../../types.ts";

// CONSTANTS
const kPeers: CollaboratorPresence[] = [
  {
    clientId: "ana",
    displayName: "Ana",
    color: peerColor(0)
  },
  {
    clientId: "bo",
    displayName: "Bo",
    color: peerColor(1)
  },
  {
    clientId: "cy",
    displayName: "Cy",
    color: peerColor(2)
  }
];

const kShadingModes = [
  {
    value: "pbr",
    label: "PBR"
  },
  {
    value: "toon",
    label: "Toon"
  },
  {
    value: "unlit",
    label: "Unlit"
  }
];

const kLayers = [
  {
    value: 1,
    label: "Default"
  },
  {
    value: 2,
    label: "Water"
  },
  {
    value: 4,
    label: "Foliage"
  },
  {
    value: 8,
    label: "Debug"
  }
];

/** Fits the widest inspector label and aligns every field row. */
const kLabelWidth = "10ch";
const kFieldTrailingWidth = "48px";

export interface EditorScenarioOptions {
  /** Displays every field state together for visual testing. */
  salted: boolean;
}

export const EDITOR_EXAMPLE: GalleryExample = {
  id: "scenarios/editor",
  title: "Editor",
  group: "Scenarios",
  render(host) {
    return mountEditor(host, { salted: false });
  }
};

export const EDITOR_STATES_EXAMPLE: GalleryExample = {
  id: "scenarios/editor-states",
  title: "Editor (salted states)",
  group: "Scenarios",
  render(host) {
    return mountEditor(host, { salted: true });
  }
};

function mountEditor(
  host: HTMLElement,
  options: EditorScenarioOptions
): () => void {
  const shell = document.createElement("div");
  shell.className = "editor-shell";
  shell.append(
    buildRail(),
    buildOutliner(),
    buildStage(options),
    buildInspector(options)
  );

  /*
   * DockLayout owns docking and persistence for both docks and the palette.
   * It uses display: contents, so it does not alter the editor grid.
   */
  const layout = document.createElement("jolly-dock-layout");
  layout.storageKey = storageKey(options, "layout");
  layout.append(shell, buildPalette());
  host.append(layout);

  return () => {
    layout.remove();
  };
}

/** Writes live and committed values back to the controlled fields. */
function bind<
  TValue,
  TField extends HTMLElement & { value: FieldValue<TValue>; }
>(
  element: TField
): TField {
  function writeBack(
    event: Event
  ): void {
    const detail = detailOf<{ value: TValue; }>(event);
    if (detail !== null) {
      element.value = detail.value;
    }
  }

  element.addEventListener("jolly-input", writeBack);
  element.addEventListener("jolly-change", writeBack);

  return element;
}

/** Creates a pane whose fields share one label column. */
function labelledPane(
  key: string,
  title: string
): HTMLElementTagNameMap["jolly-pane"] {
  const pane = document.createElement("jolly-pane");
  pane.key = key;
  pane.heading = title;
  pane.collapsible = true;
  pane.style.setProperty("--jolly-label-width", kLabelWidth);

  return pane;
}

function buildRail(): HTMLElementTagNameMap["jolly-rail"] {
  const rail = document.createElement("jolly-rail");
  const tools: [string, string][] = [
    ["search", "Select"],
    ["eye", "Paint"],
    ["drag", "Move"],
    ["check", "Measure"]
  ];

  for (const [icon, label] of tools) {
    const button = document.createElement("jolly-button");
    button.setAttribute("icon-only", "");
    button.setAttribute("aria-label", label);
    button.title = label;

    const glyph = document.createElement("jolly-icon");
    glyph.name = icon;
    button.append(glyph);
    rail.append(button);
  }

  return rail;
}

function buildOutliner(): HTMLElementTagNameMap["jolly-dock"] {
  const dock = document.createElement("jolly-dock");
  dock.side = "left";
  dock.key = "outliner";
  dock.align = "start";
  dock.collapsible = true;

  const pane = labelledPane("outliner", "Outliner");
  pane.grow = false;

  const scene = document.createElement("jolly-folder");
  scene.label = "Scene";
  scene.open = true;

  for (const name of ["Terrain", "Water", "Player", "Camera"]) {
    const row = document.createElement("jolly-property-row");
    row.label = name;
    row.align = "end";
    const visible = bind(document.createElement("jolly-checkbox"));
    visible.align = "end";
    visible.clickableBackground = true;
    visible.value = name !== "Debug";
    row.append(visible);
    scene.append(row);
  }

  pane.append(scene, buildStats());
  dock.append(pane);

  return dock;
}

function buildStats(): HTMLElementTagNameMap["jolly-folder"] {
  const folder = document.createElement("jolly-folder");
  folder.label = "Statistics";
  folder.open = true;

  for (const [label, value] of [["Draw calls", "412"], ["Triangles", "1.24M"]]) {
    const row = document.createElement("jolly-property-row");
    row.label = label;
    row.align = "end";
    const readout = document.createElement("span");
    readout.textContent = value;
    row.append(readout);
    folder.append(row);
  }

  return folder;
}

function buildStage(
  options: EditorScenarioOptions
): HTMLElement {
  const column = document.createElement("div");
  column.className = "editor-stage";

  const toolbar = document.createElement("jolly-toolbar");

  const modes = document.createElement("jolly-button-group");
  modes.label = "";
  modes.options = [
    {
      value: "object",
      label: "Object"
    },
    {
      value: "edit",
      label: "Edit"
    },
    {
      value: "paint",
      label: "Paint"
    }
  ];
  modes.value = "object";
  bind(modes);

  const destructive = document.createElement("jolly-button");
  destructive.setAttribute("variant", "danger");
  destructive.textContent = "Delete selection";
  destructive.addEventListener("click", () => {
    void showConfirm({
      title: "Delete selection?",
      message: "Three objects will be removed from the scene.",
      confirmLabel: "Delete"
    });
  });

  toolbar.append(modes, destructive);

  const viewport = document.createElement("div");
  viewport.className = "editor-viewport";
  viewport.textContent = options.salted
    ? "Every field state, on one screen"
    : "Viewport";

  column.append(toolbar, viewport);

  return column;
}

function buildInspector(
  options: EditorScenarioOptions
): HTMLElementTagNameMap["jolly-dock"] {
  const dock = document.createElement("jolly-dock");
  dock.side = "right";
  dock.key = "inspector";
  dock.align = "start";
  dock.collapsible = true;
  dock.style.setProperty(
    "--jolly-field-trailing-width",
    kFieldTrailingWidth
  );

  // Reserve lock space so peer edits do not shift inspector rows.
  if (options.salted) {
    dock.style.setProperty("--jolly-gutter-width", "14px");
  }

  const pane = labelledPane("inspector", "Inspector");
  pane.grow = false;
  pane.append(
    buildTransform(options),
    buildMaterial(options),
    buildPhysics(options)
  );

  dock.append(pane);

  return dock;
}

function buildTransform(
  options: EditorScenarioOptions
): HTMLElementTagNameMap["jolly-folder"] {
  const folder = document.createElement("jolly-folder");
  folder.label = "Transform";
  folder.open = true;

  const position = bind(document.createElement("jolly-vector3"));
  position.label = "Position";
  position.step = 0.1;
  position.value = { x: 12, y: 0, z: -4.5 };
  position.default = { x: 0, y: 0, z: 0 };
  folder.append(position);

  const scale = bind(document.createElement("jolly-slider"));
  scale.label = "Scale";
  scale.min = 0;
  scale.max = 4;
  scale.step = 0.05;
  scale.value = 1.35;
  scale.default = 1;
  folder.append(separator(), scale);

  if (options.salted) {
    const readonlyField = bind(document.createElement("jolly-number"));
    readonlyField.label = "Bounds";
    readonlyField.value = 128;
    readonlyField.readonly = true;
    readonlyField.align = "end";
    readonlyField.description = "Derived from the mesh, not editable.";

    // 45 degrees about Y.
    const rotation = bind(document.createElement("jolly-quaternion"));
    rotation.label = "Rotation";
    rotation.value = {
      x: 0,
      y: 0.3826834323650898,
      z: 0,
      w: 0.9238795325112867
    };
    rotation.lockedBy = kPeers[0];
    rotation.peers = [kPeers[0], kPeers[1]];

    folder.append(readonlyField, rotation);
  }

  return folder;
}

function buildMaterial(
  options: EditorScenarioOptions
): HTMLElementTagNameMap["jolly-folder"] {
  const folder = document.createElement("jolly-folder");
  folder.label = "Material";
  folder.open = true;

  const albedo = bind(document.createElement("jolly-color"));
  albedo.label = "Albedo";
  albedo.value = "#4488ff";
  albedo.default = "#ffffff";

  const roughness = bind(document.createElement("jolly-slider"));
  roughness.label = "Roughness";
  roughness.min = 0;
  roughness.max = 1;
  roughness.step = 0.01;
  roughness.value = 0.42;
  roughness.default = 0.5;

  const shading = bind(document.createElement("jolly-select"));
  shading.label = "Shading";
  shading.options = kShadingModes;
  shading.value = "pbr";

  const name = bind(document.createElement("jolly-text"));
  name.label = "Name";
  name.value = "terrain_rock_01";

  folder.append(
    albedo,
    roughness,
    separator("Shading"),
    shading,
    name
  );

  if (options.salted) {
    const errored = bind(document.createElement("jolly-text"));
    errored.label = "Texture";
    errored.value = "rock_diffuse";
    errored.error = "No file matches that name.";

    const mixed = bind(document.createElement("jolly-select"));
    mixed.label = "Blend";
    mixed.options = kShadingModes;
    mixed.value = Mixed;

    const peered = bind(document.createElement("jolly-slider"));
    peered.label = "Metalness";
    peered.min = 0;
    peered.max = 1;
    peered.step = 0.01;
    peered.value = 0.8;
    peered.peers = kPeers;

    const erroredSlider = bind(document.createElement("jolly-slider"));
    erroredSlider.label = "Emission";
    erroredSlider.min = 0;
    erroredSlider.max = 10;
    erroredSlider.step = 0.1;
    erroredSlider.value = 8.5;
    erroredSlider.error = "Above the safe range for this material.";

    folder.append(errored, mixed, peered, erroredSlider);
  }

  return folder;
}

function buildPhysics(
  options: EditorScenarioOptions
): HTMLElementTagNameMap["jolly-folder"] {
  const folder = document.createElement("jolly-folder");
  folder.label = "Physics";
  folder.open = true;

  const collides = bind(document.createElement("jolly-checkbox"));
  collides.label = "Collides";
  collides.clickableBackground = true;
  collides.value = true;
  collides.default = true;

  const damping = bind(document.createElement("jolly-range"));
  damping.label = "Damping";
  damping.min = 0;
  damping.max = 1;
  damping.step = 0.01;
  damping.value = {
    from: 0.1,
    to: 0.6
  };

  const layers = bind(document.createElement("jolly-flags"));
  layers.label = "Layers";
  layers.options = kLayers;
  layers.value = 5;

  folder.append(collides, damping, separator(), layers);

  if (options.salted) {
    const disabled = bind(document.createElement("jolly-checkbox"));
    disabled.label = "Kinematic";
    disabled.clickableBackground = true;
    disabled.value = false;
    disabled.disabled = true;

    folder.append(disabled);
  }

  return folder;
}

function buildPalette(): HTMLElementTagNameMap["jolly-floating"] {
  const floating = document.createElement("jolly-floating");
  // Start over the viewport and preserve this size across docking.
  floating.x = 560;
  floating.y = 96;
  floating.width = 260;
  floating.height = 232;

  const pane = labelledPane("brush", "Brush");
  pane.style.setProperty(
    "--jolly-field-trailing-width",
    kFieldTrailingWidth
  );

  const size = bind(document.createElement("jolly-slider"));
  size.label = "Size";
  size.min = 1;
  size.max = 64;
  size.step = 1;
  size.value = 18;
  size.default = 8;

  const opacity = bind(document.createElement("jolly-slider"));
  opacity.label = "Opacity";
  opacity.min = 0;
  opacity.max = 1;
  opacity.step = 0.01;
  opacity.value = 1;

  const primary = bind(document.createElement("jolly-color"));
  primary.label = "Primary";
  primary.alpha = true;
  primary.value = "#e2b33ccc";

  pane.append(size, opacity, separator("Colour"), primary);
  floating.append(pane);

  return floating;
}

function separator(
  label = ""
): HTMLElementTagNameMap["jolly-separator"] {
  const element = document.createElement("jolly-separator");
  element.label = label;

  return element;
}

function storageKey(
  options: EditorScenarioOptions,
  name: string
): string {
  const variant = options.salted ? "states" : "plain";

  return `gallery-example:editor:${variant}:${name}`;
}
