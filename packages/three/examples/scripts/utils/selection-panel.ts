// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { Pane } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionVisibility,
  PeerSelectionChips,
  HighlightPass,
  HighlightPassJfa,
  type SelectionTechnique
} from "../../../src/index.ts";

/**
 * The three peer-layer mechanisms `@jolly-pixel/three` ships, mutually
 * exclusive in every example so the scene stays legible - see whichever
 * `onPeerModeChange` callback a caller passes to `bindSelectionAndPeerPanel`
 * for what each one actually builds/disposes.
 */
export type PeerRenderingMode = "overlays" | "colors" | "colorsJfa";

/**
 * `SelectionTechnique` -> `PeerRenderingMode`, one direction only - the panel
 * exposes a single "mode" control (`SelectionTechnique`'s own vocabulary,
 * since `SelectionManager.setTechnique` is the underlying setter either way)
 * and derives the peer mechanism from it, rather than keeping two synced
 * dropdowns. `SelectionManager` already skips its own local overlay under a
 * scene-level pipeline technique, and `PeerSelectionOverlays` never renders
 * the local selection at all - see each class's own doc comment - so a
 * mismatch between the two was never actually representable, just two knobs
 * for one choice.
 */
const kTechniqueToPeerMode: Record<SelectionTechnique, PeerRenderingMode> = {
  outline: "overlays",
  highlight: "colors",
  highlightJfa: "colorsJfa"
};

export interface SelectionPeerPanelOptions {
  pane: Pane;
  selectionManager: SelectionManager;
  peerVisibility: PeerSelectionVisibility;
  highlight: HighlightPass;
  highlightJfa: HighlightPassJfa;
  /**
   * Toggled from the "Peer visibility" folder's own "peer chips" binding when
   * given - omit in a demo that never constructs a `PeerSelectionChips`.
   */
  peerChips?: PeerSelectionChips;
  /**
   * Builds/disposes whichever of `PeerSelectionOverlays`/`PeerHighlightPass`
   * the derived peer mode requires - left to the caller since only it knows
   * its own scene-specific extras (e.g. a group's peer bounding box). Called
   * once immediately for the manager's current technique, then again on
   * every "mode" change.
   */
  onPeerModeChange: (mode: PeerRenderingMode) => void;
  /**
   * Called after `selectionManager.setBoundingBoxOptions` - only meaningful
   * alongside `boundingBox: true`. `SelectionManager` already rebuilds its
   * *own* local bounding-box overlay on every options change, but a peer's
   * group overlay (built and owned entirely by the caller, outside this
   * helper) does not - use this to force that rebuild too, the same way
   * `selection.ts`'s own `refreshPeerGroupBoxes` does.
   */
  onBoundingBoxOptionsChange?: () => void;
  /**
   * Called after `selectionManager.setXray`. `setXray` dispatches no event
   * of its own, so an already-built `PeerSelectionOverlays` instance (if the
   * caller has one active) has nothing to react to - pass e.g.
   * `() => peerSelectionOverlays?.refreshAll()` to keep an already-selected
   * peer's overlay in sync; see `PeerSelectionOverlays.refreshAll`'s own doc
   * comment for why that call can't happen automatically.
   */
  onXrayChange?: () => void;
  /**
   * Shows "group opacity" - only meaningful when the demo registers a
   * non-mesh (group) target, which always renders `SelectionBoundingBox`
   * regardless of mode.
   */
  boundingBox?: boolean;
  maxDistance: { default: number; max: number; };
  /**
   * Inserted into the "Peer rendering" folder right after the priority hint,
   * before edge/ring tuning - e.g. an occluder toggle.
   */
  extraPeerBindings?: (peerFolder: ReturnType<Pane["addFolder"]>) => void;
}

export interface SelectionPeerPanel {
  selectionFolder: ReturnType<Pane["addFolder"]>;
  peerFolder: ReturnType<Pane["addFolder"]>;
  peerVisibilityFolder: ReturnType<Pane["addFolder"]>;
}

/**
 * Builds the "Selection" (mode/colors/outline/x-ray), "Peer rendering"
 * (technique tuning), and "Peer visibility" (chips/max distance) folders
 * shared by every `SelectionManager`-driven example - `selection.ts`
 * and `selection-peer.ts` differ only in scene setup and a handful of
 * scenario-specific extras, so this is the single place their common panel
 * wiring lives, rather than two drifting copies.
 */
export function bindSelectionAndPeerPanel(
  options: SelectionPeerPanelOptions
): SelectionPeerPanel {
  const {
    pane,
    selectionManager,
    peerVisibility,
    highlight,
    highlightJfa,
    peerChips,
    onPeerModeChange,
    onBoundingBoxOptionsChange,
    onXrayChange,
    boundingBox = false,
    maxDistance,
    extraPeerBindings
  } = options;

  const selectionFolder = pane.addFolder({ title: "Selection" });

  // Folder-general context, not tied to any one control below it, so it
  // comes first - a hint that explains the category as a whole leads; a
  // hint that only clarifies one specific option stays right next to that
  // option instead (e.g. "max distance"'s own hint, further down).
  const modeHintRow = document.createElement("jolly-property-row");
  modeHintRow.description = "\"outline\" is per-object and x-ray-capable; \"highlight\" is a scene-wide " +
    "postprocess, always fully visible. Also decides how peer selections render, in \"Peer rendering\" below.";
  selectionFolder.element.append(modeHintRow);

  const modeSettings = { mode: selectionManager.technique };
  selectionFolder
    .addBinding(modeSettings, "mode", {
      label: "mode",
      options: {
        outline: "outline",
        "highlight (blur)": "highlight",
        "highlight (JFA)": "highlightJfa"
      } satisfies Record<string, SelectionTechnique>
    })
    .on("change", ({ value }) => {
      selectionManager.setTechnique(value);
      onPeerModeChange(kTechniqueToPeerMode[value] ?? "overlays");
      updateVisibility();
    });

  const colorSettings = {
    color: `#${new THREE.Color(selectionManager.color).getHexString()}`,
    hoverColor: `#${new THREE.Color(selectionManager.hoverColor).getHexString()}`,
    hoverOpacity: selectionManager.hoverOpacity
  };
  selectionFolder
    .addBinding(colorSettings, "color", { label: "selected" })
    .on("change", ({ value }) => selectionManager.setColor(value));
  selectionFolder
    .addBinding(colorSettings, "hoverColor", { label: "hover" })
    .on("change", ({ value }) => selectionManager.setHoverColor(value));
  selectionFolder
    .addBinding(colorSettings, "hoverOpacity", { label: "hover opacity", min: 0, max: 1, step: 0.05 })
    .on("change", ({ value }) => selectionManager.setHoverOpacity(value));

  // Grouped with "hover opacity" above rather than with "outline width"
  // below it - both are 0-1 opacity sliders; "outline width" is a different
  // unit (px-ish steps) and sits with "x-ray" after, as appearance/technique
  // tuning rather than an opacity.
  if (boundingBox) {
    const boundingBoxSettings = { fillOpacity: selectionManager.boundingBoxOptions.fillOpacity ?? 0 };
    selectionFolder
      .addBinding(boundingBoxSettings, "fillOpacity", { label: "group opacity", min: 0, max: 1, step: 0.05 })
      .on("change", ({ value }) => {
        selectionManager.setBoundingBoxOptions({ fillOpacity: value });
        onBoundingBoxOptionsChange?.();
      });
  }

  const outlineSettings = { linewidth: selectionManager.outlineOptions.linewidth ?? 1 };
  const linewidthBinding = selectionFolder
    .addBinding(outlineSettings, "linewidth", { label: "outline width", min: 1, max: 10, step: 1 })
    .on("change", ({ value }) => selectionManager.setOutlineOptions({ linewidth: value }));

  const xraySettings = { xray: selectionManager.xray };
  const xrayBinding = selectionFolder
    .addBinding(xraySettings, "xray", { label: "x-ray" })
    .on("change", ({ value }) => {
      selectionManager.setXray(value);
      onXrayChange?.();
    });

  const peerFolder = pane.addFolder({ title: "Peer rendering" });

  // Unlike `modeHintRow`/`visibilityHintRow`, this one is *not* folder-general
  // despite reading that way at a glance - it's true only under "colors"/
  // "colorsJfa", exactly like `edgeThicknessBinding`/`ringThicknessBinding`
  // below, so `updateVisibility` hides it on the same condition rather than
  // always leading the folder.
  const priorityHintRow = document.createElement("jolly-property-row");
  priorityHintRow.description = "Your own selection always wins overlaps with peers in both \"colors\" modes.";
  peerFolder.element.append(priorityHintRow);

  extraPeerBindings?.(peerFolder);

  const highlightSettings = { edgeThickness: highlight.edgeThickness };
  const edgeThicknessBinding = peerFolder
    .addBinding(highlightSettings, "edgeThickness", { label: "edge thickness", min: 1, max: 10, step: 1 })
    .on("change", ({ value }) => highlight.setEdgeThickness(value));

  const highlightJfaSettings = { ringThickness: highlightJfa.ringThickness };
  const ringThicknessBinding = peerFolder
    .addBinding(highlightJfaSettings, "ringThickness", { label: "ring thickness (px)", min: 1, max: 10, step: 1 })
    .on("change", ({ value }) => highlightJfa.setRingThickness(value));

  // Separate from "Peer rendering" (which technique draws a peer) - this is
  // "which peers are even worth drawing", so it groups the chips toggle with
  // the visibility/culling knob rather than with edge/ring tuning.
  const peerVisibilityFolder = pane.addFolder({ title: "Peer visibility" });

  if (peerChips) {
    const chipsSettings = { chips: peerChips.enabled };
    peerVisibilityFolder
      .addBinding(chipsSettings, "chips", { label: "peer chips" })
      .on("change", ({ value }) => peerChips.setEnabled(value));
  }

  // Option-specific, not folder-general - stays right next to "max distance"
  // rather than moving to the top, unlike `modeHintRow`/`priorityHintRow`
  // above.
  const visibilityHintRow = document.createElement("jolly-property-row");
  visibilityHintRow.description = "Skips indicator cost for distant/off-screen peers - \"colors\" modes have " +
    "no per-object culling of their own without this, and it keeps rings readable on tiny far silhouettes.";
  peerVisibilityFolder.element.append(visibilityHintRow);

  const visibilitySettings = { maxDistance: maxDistance.default };
  peerVisibilityFolder
    .addBinding(visibilitySettings, "maxDistance", { label: "max distance", min: 0, max: maxDistance.max, step: 1 })
    .on("change", ({ value }) => peerVisibility.setMaxDistance(value));

  /**
   * Hides (rather than merely disables) every binding that does nothing
   * under the current mode - `linewidth`/`xray` only affect an
   * `"outline"`-mode overlay, `edgeThickness`/`ringThickness`/`priorityHintRow`
   * only their own matching "colors" peer mode, which `kTechniqueToPeerMode`
   * derives directly from `mode` - a single source of truth, so there's no
   * separate peer-mode state to fall out of sync with it.
   *
   * Under "overlays" mode, "Peer rendering" would otherwise show only its
   * (now-hidden) hint row and nothing else, a header over an empty folder -
   * unless the caller populated it with something always-relevant via
   * `extraPeerBindings` (e.g. an occluder toggle), in which case the folder
   * itself stays visible and only the mode-specific rows inside it hide.
   */
  function updateVisibility(): void {
    const outlineActive = modeSettings.mode === "outline";
    linewidthBinding.hidden = !outlineActive;
    xrayBinding.hidden = !outlineActive;

    const peerMode = kTechniqueToPeerMode[modeSettings.mode] ?? "overlays";
    const colorsModeActive = peerMode !== "overlays";
    priorityHintRow.hidden = !colorsModeActive;
    edgeThicknessBinding.hidden = peerMode !== "colors";
    ringThicknessBinding.hidden = peerMode !== "colorsJfa";
    peerFolder.hidden = !colorsModeActive && !extraPeerBindings;
  }

  onPeerModeChange(kTechniqueToPeerMode[selectionManager.technique] ?? "overlays");
  updateVisibility();

  return {
    selectionFolder,
    peerFolder,
    peerVisibilityFolder
  };
}
