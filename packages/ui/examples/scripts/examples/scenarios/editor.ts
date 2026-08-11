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
/**
 * Both pages are built from these two functions, so the realistic one and the
 * salted one cannot drift into different layouts.
 */
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

/**
 * Widest label in the inspector is "Position X" at ten characters. Setting the
 * shared column on the pane aligns every value in it, including the property
 * rows, which size from the same token.
 */
const kLabelWidth = "10ch";
const kFieldTrailingWidth = "48px";

export interface EditorScenarioOptions {
  /**
   * Puts one row into each field state at once. No real inspector looks like
   * this, which is the point: it is the only way to see every state channel
   * against the others on a single screen.
   */
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
    buildOutliner(options),
    buildStage(options),
    buildInspector(options)
  );

  const palette = buildPalette(options);
  host.append(shell, palette);

  return () => {
    shell.remove();
    palette.remove();
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

/**
 * A pane whose fields share one label column.
 */
function labelledPane(
  title: string
): HTMLElementTagNameMap["jolly-pane"] {
  const pane = document.createElement("jolly-pane");
  pane.title = title;
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

function buildOutliner(
  options: EditorScenarioOptions
): HTMLElementTagNameMap["jolly-dock"] {
  const dock = document.createElement("jolly-dock");
  dock.side = "left";
  dock.collapsible = true;
  dock.storageKey = storageKey(options, "outliner");

  const pane = labelledPane("Outliner");

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
  dock.collapsible = true;
  dock.storageKey = storageKey(options, "inspector");
  dock.style.setProperty(
    "--jolly-field-trailing-width",
    kFieldTrailingWidth
  );

  /*
   * The inspector is the collaborative surface here, so it opts its subtree into
   * the reserved gutter. That is what keeps a row from shifting when a peer
   * takes or releases a lock.
   */
  if (options.salted) {
    dock.style.setProperty("--jolly-gutter-width", "14px");
  }

  const pane = labelledPane("Inspector");
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

  const axes: [string, number][] = [
    ["Position X", 12],
    ["Position Y", 0],
    ["Position Z", -4.5]
  ];

  // Digits line up down the column when the value sits against the trailing edge.
  for (const [label, value] of axes) {
    const field = bind(document.createElement("jolly-number"));
    field.label = label;
    field.step = 0.1;
    field.value = value;
    field.default = 0;
    field.align = "end";
    folder.append(field);
  }

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

    const lockedField = bind(document.createElement("jolly-number"));
    lockedField.label = "Rotation Y";
    lockedField.value = 45;
    lockedField.lockedBy = kPeers[0];
    lockedField.peers = [kPeers[0], kPeers[1]];

    folder.append(readonlyField, lockedField);
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

function buildPalette(
  options: EditorScenarioOptions
): HTMLElementTagNameMap["jolly-floating"] {
  const floating = document.createElement("jolly-floating");
  // Over the viewport, so it never starts on top of either dock.
  floating.x = 820;
  floating.y = 96;
  floating.storageKey = storageKey(options, "palette");

  const pane = labelledPane("Brush");
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
