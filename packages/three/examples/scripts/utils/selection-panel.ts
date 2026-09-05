// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { Pane } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  type SelectionRenderMode,
  SelectionSystem
} from "../../../src/index.ts";

export interface SelectionPeerPanelOptions {
  pane: Pane;
  selection: SelectionSystem;
  boundingBox?: boolean;
  maxDistance: { default: number; max: number; };
  onModeChange?: (mode: SelectionRenderMode) => void;
  extraPeerBindings?: (peerFolder: ReturnType<Pane["addFolder"]>) => void;
}

export interface SelectionPeerPanel {
  selectionFolder: ReturnType<Pane["addFolder"]>;
  peerFolder: ReturnType<Pane["addFolder"]>;
  peerVisibilityFolder: ReturnType<Pane["addFolder"]>;
}

/**
 * Builds the selection controls shared by the selection examples.
 */
export function bindSelectionAndPeerPanel(
  options: SelectionPeerPanelOptions
): SelectionPeerPanel {
  const {
    pane,
    selection,
    boundingBox = false,
    maxDistance,
    onModeChange,
    extraPeerBindings
  } = options;
  const appearance = selection.appearance;
  const selectionFolder = pane.addFolder({ title: "Selection" });

  const modeHintRow = document.createElement("jolly-property-row");
  modeHintRow.description = "The selection system owns local and peer rendering, including mode changes.";
  selectionFolder.element.append(modeHintRow);

  const modeSettings = { mode: selection.mode };
  selectionFolder
    .addBinding(modeSettings, "mode", {
      label: "mode",
      options: {
        outline: "outline",
        "highlight (blur)": "highlight",
        "highlight (JFA)": "highlightJfa"
      } satisfies Record<string, SelectionRenderMode>
    })
    .on("change", ({ value }) => {
      selection.mode = value;
      onModeChange?.(value);
      updateVisibility();
    });

  const colorSettings = {
    color: `#${new THREE.Color(appearance.selected.color).getHexString()}`,
    hoverColor: `#${new THREE.Color(appearance.hovered.color).getHexString()}`,
    hoverOpacity: appearance.hovered.opacity
  };
  selectionFolder
    .addBinding(colorSettings, "color", { label: "selected" })
    .on("change", ({ value }) => selection.configure({ selected: { color: value } }));
  selectionFolder
    .addBinding(colorSettings, "hoverColor", { label: "hover" })
    .on("change", ({ value }) => selection.configure({ hovered: { color: value } }));
  selectionFolder
    .addBinding(colorSettings, "hoverOpacity", { label: "hover opacity", min: 0, max: 1, step: 0.05 })
    .on("change", ({ value }) => selection.configure({ hovered: { opacity: value } }));

  if (boundingBox) {
    const boundsSettings = { fillOpacity: appearance.bounds.fillOpacity };
    selectionFolder
      .addBinding(boundsSettings, "fillOpacity", { label: "group opacity", min: 0, max: 1, step: 0.05 })
      .on("change", ({ value }) => selection.configure({ bounds: { fillOpacity: value } }));
  }

  const outlineSettings = { linewidth: appearance.outline.linewidth };
  const linewidthBinding = selectionFolder
    .addBinding(outlineSettings, "linewidth", { label: "outline width", min: 1, max: 10, step: 1 })
    .on("change", ({ value }) => selection.configure({ outline: { linewidth: value } }));

  const xraySettings = { xray: appearance.xray };
  const xrayBinding = selectionFolder
    .addBinding(xraySettings, "xray", { label: "x-ray" })
    .on("change", ({ value }) => selection.configure({ xray: value }));

  const peerFolder = pane.addFolder({ title: "Peer rendering" });
  const priorityHintRow = document.createElement("jolly-property-row");
  priorityHintRow.description = "Your own selection wins silhouette overlaps in both highlight modes.";
  peerFolder.element.append(priorityHintRow);
  extraPeerBindings?.(peerFolder);

  const highlightSettings = { edgeThickness: appearance.highlight.edgeThickness };
  const edgeThicknessBinding = peerFolder
    .addBinding(highlightSettings, "edgeThickness", { label: "edge thickness", min: 1, max: 10, step: 1 })
    .on("change", ({ value }) => selection.configure({ highlight: { edgeThickness: value } }));

  const highlightJfaSettings = {
    ringThickness: appearance.highlightJfa.ringThickness,
    borderThickness: appearance.highlightJfa.borderThickness,
    isolatedFillOpacity: appearance.highlightJfa.isolatedFillOpacity
  };
  const ringThicknessBinding = peerFolder
    .addBinding(highlightJfaSettings, "ringThickness", { label: "ring thickness (px)", min: 1, max: 10, step: 1 })
    .on("change", ({ value }) => selection.configure({ highlightJfa: { ringThickness: value } }));
  const borderThicknessBinding = peerFolder
    .addBinding(highlightJfaSettings, "borderThickness", { label: "border thickness (px)", min: 0, max: 10, step: 1 })
    .on("change", ({ value }) => selection.configure({ highlightJfa: { borderThickness: value } }));
  const isolatedFillOpacityBinding = peerFolder
    .addBinding(highlightJfaSettings, "isolatedFillOpacity", {
      label: "hover fill opacity", min: 0, max: 1, step: 0.05
    })
    .on("change", ({ value }) => selection.configure({ highlightJfa: { isolatedFillOpacity: value } }));

  const peerVisibilityFolder = pane.addFolder({ title: "Peer visibility" });
  const chipsSettings = { chips: selection.chips.enabled };
  peerVisibilityFolder
    .addBinding(chipsSettings, "chips", { label: "peer chips" })
    .on("change", ({ value }) => {
      selection.chips.enabled = value;
    });

  if (selection.visibility) {
    const visibilityHintRow = document.createElement("jolly-property-row");
    visibilityHintRow.description = "Skips remote indicators that are distant or outside the camera frustum.";
    peerVisibilityFolder.element.append(visibilityHintRow);

    const visibilitySettings = { maxDistance: maxDistance.default };
    peerVisibilityFolder
      .addBinding(visibilitySettings, "maxDistance", {
        label: "max distance", min: 0, max: maxDistance.max, step: 1
      })
      .on("change", ({ value }) => {
        selection.visibility!.maxDistance = value;
      });
  }

  function updateVisibility(): void {
    const outlineActive = modeSettings.mode === "outline";
    linewidthBinding.hidden = !outlineActive;
    xrayBinding.hidden = !outlineActive;
    priorityHintRow.hidden = outlineActive;
    edgeThicknessBinding.hidden = modeSettings.mode !== "highlight";
    ringThicknessBinding.hidden = modeSettings.mode !== "highlightJfa";
    borderThicknessBinding.hidden = modeSettings.mode !== "highlightJfa";
    isolatedFillOpacityBinding.hidden = modeSettings.mode !== "highlightJfa";
    peerFolder.hidden = outlineActive && !extraPeerBindings;
  }

  updateVisibility();

  return {
    selectionFolder,
    peerFolder,
    peerVisibilityFolder
  };
}
