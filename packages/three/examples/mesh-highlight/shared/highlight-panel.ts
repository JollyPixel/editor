// Import Third-party Dependencies
import type { Pane } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  type MeshHighlightMode,
  MeshHighlight
} from "../../../src/index.ts";
import { hexOf } from "./selectables.ts";

type PaneFolder = ReturnType<Pane["addFolder"]>;

interface Hideable {
  hidden: boolean | string;
}

interface ModeScopedElement {
  element: Hideable;
  modes: MeshHighlightMode[];
}

export interface HighlightPeerPanelOptions {
  pane: Pane;
  highlight: MeshHighlight;
  boundingBox?: boolean;
  maxDistance: { default: number; max: number; };
  onModeChange?: (mode: MeshHighlightMode) => void;
  extraPeerBindings?: (peerFolder: PaneFolder) => void;
}

export function bindHighlightAndPeerPanel(
  options: HighlightPeerPanelOptions
): void {
  const {
    pane,
    highlight,
    boundingBox = false,
    maxDistance,
    onModeChange,
    extraPeerBindings
  } = options;
  const appearance = highlight.appearance;
  const scoped: ModeScopedElement[] = [];

  function only(
    modes: MeshHighlightMode[],
    element: Hideable
  ): void {
    scoped.push({ element, modes });
  }

  const highlightFolder = pane.addFolder({ title: "Selection" });

  const modeHintRow = document.createElement("jolly-property-row");
  modeHintRow.description = "MeshHighlight owns local and peer rendering, including mode changes.";
  highlightFolder.element.append(modeHintRow);

  const modeSettings = { mode: highlight.mode };
  highlightFolder
    .addBinding(modeSettings, "mode", {
      label: "mode",
      options: {
        outline: "outline",
        "highlight (blur)": "highlight",
        "highlight (JFA)": "highlightJfa"
      } satisfies Record<string, MeshHighlightMode>
    })
    .on("change", ({ value }) => {
      highlight.mode = value;
      onModeChange?.(value);
      updateVisibility();
    });

  const colorSettings = {
    color: hexOf(appearance.selected.color),
    hoverColor: hexOf(appearance.hovered.color),
    hoverOpacity: appearance.hovered.opacity
  };
  highlightFolder
    .addBinding(colorSettings, "color", { label: "selected" })
    .on("change", ({ value }) => highlight.configure({ selected: { color: value } }));
  highlightFolder
    .addBinding(colorSettings, "hoverColor", { label: "hover" })
    .on("change", ({ value }) => highlight.configure({ hovered: { color: value } }));
  highlightFolder
    .addBinding(colorSettings, "hoverOpacity", { label: "hover opacity", min: 0, max: 1, step: 0.05 })
    .on("change", ({ value }) => highlight.configure({ hovered: { opacity: value } }));

  if (boundingBox) {
    const boundsSettings = { fillOpacity: appearance.bounds.fillOpacity };
    highlightFolder
      .addBinding(boundsSettings, "fillOpacity", { label: "group opacity", min: 0, max: 1, step: 0.05 })
      .on("change", ({ value }) => highlight.configure({ bounds: { fillOpacity: value } }));
  }

  const outlineSettings = { linewidth: appearance.outline.linewidth };
  only(["outline"], highlightFolder
    .addBinding(outlineSettings, "linewidth", { label: "outline width", min: 1, max: 10, step: 1 })
    .on("change", ({ value }) => highlight.configure({ outline: { linewidth: value } })));

  const xraySettings = { xray: appearance.xray };
  only(["outline"], highlightFolder
    .addBinding(xraySettings, "xray", { label: "x-ray" })
    .on("change", ({ value }) => highlight.configure({ xray: value })));

  const peerFolder = pane.addFolder({ title: "Peer rendering" });
  const priorityHintRow = document.createElement("jolly-property-row");
  priorityHintRow.description = "Your own selection wins silhouette overlaps in both highlight modes.";
  peerFolder.element.append(priorityHintRow);
  only(["highlight", "highlightJfa"], priorityHintRow);
  extraPeerBindings?.(peerFolder);

  const highlightSettings = { edgeThickness: appearance.highlight.edgeThickness };
  only(["highlight"], peerFolder
    .addBinding(highlightSettings, "edgeThickness", { label: "edge thickness", min: 1, max: 10, step: 1 })
    .on("change", ({ value }) => highlight.configure({ highlight: { edgeThickness: value } })));

  const highlightJfaSettings = {
    ringThickness: appearance.highlightJfa.ringThickness,
    borderThickness: appearance.highlightJfa.borderThickness,
    isolatedFillOpacity: appearance.highlightJfa.isolatedFillOpacity
  };
  only(["highlightJfa"], peerFolder
    .addBinding(
      highlightJfaSettings,
      "ringThickness",
      { label: "ring thickness (px)", min: 1, max: 10, step: 1 }
    )
    .on("change", ({ value }) => highlight.configure({ highlightJfa: { ringThickness: value } })));
  only(["highlightJfa"], peerFolder
    .addBinding(
      highlightJfaSettings,
      "borderThickness",
      { label: "border thickness (px)", min: 0, max: 10, step: 1 }
    )
    .on("change", ({ value }) => highlight.configure({ highlightJfa: { borderThickness: value } })));
  only(["highlightJfa"], peerFolder
    .addBinding(highlightJfaSettings, "isolatedFillOpacity", {
      label: "hover fill opacity", min: 0, max: 1, step: 0.05
    })
    .on("change", ({ value }) => highlight.configure({ highlightJfa: { isolatedFillOpacity: value } })));

  const peerVisibilityFolder = pane.addFolder({ title: "Peer visibility" });
  const chipsSettings = { chips: highlight.chips.enabled };
  peerVisibilityFolder
    .addBinding(chipsSettings, "chips", { label: "peer chips" })
    .on("change", ({ value }) => {
      highlight.chips.enabled = value;
    });

  const { visibility } = highlight;
  if (visibility) {
    const visibilityHintRow = document.createElement("jolly-property-row");
    visibilityHintRow.description = "Skips remote indicators that are distant or outside the camera frustum.";
    peerVisibilityFolder.element.append(visibilityHintRow);

    const visibilitySettings = { maxDistance: maxDistance.default };
    peerVisibilityFolder
      .addBinding(visibilitySettings, "maxDistance", {
        label: "max distance", min: 0, max: maxDistance.max, step: 1
      })
      .on("change", ({ value }) => {
        visibility.maxDistance = value;
      });
  }

  function updateVisibility(): void {
    for (const { element, modes } of scoped) {
      element.hidden = !modes.includes(modeSettings.mode);
    }

    peerFolder.hidden = modeSettings.mode === "outline" && !extraPeerBindings;
  }

  updateVisibility();
}
