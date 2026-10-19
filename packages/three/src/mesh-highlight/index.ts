export type {
  HighlightTechnique,
  MeshHighlightChangeEventDetail,
  MeshHighlightChangeKind,
  MeshHighlightMode,
  SelectableObject
} from "./MeshHighlightState.ts";
export {
  MeshHighlightAppearance,
  type HighlightBoundsAppearance,
  type HighlightBoundsAppearanceOptions,
  type HighlightIndicatorAppearance,
  type HighlightIndicatorAppearanceOptions,
  type HighlightOutlineAppearance,
  type HighlightOutlineAppearanceOptions,
  type HighlightPassAppearance,
  type HighlightPassAppearanceOptions,
  type HighlightPassJfaAppearance,
  type HighlightPassJfaAppearanceOptions,
  type MeshHighlightAppearanceOptions
} from "./MeshHighlightAppearance.ts";
export type {
  HighlightIndicatorSource,
  ResolvedHighlightIndicator
} from "./HighlightResolver.ts";
export {
  MeshHighlight,
  type MeshHighlightEventMap,
  type MeshHighlightOptions,
  type MeshHighlightRendererContext,
  type MeshHighlightRendererFactory
} from "./MeshHighlight.ts";
export type { MeshHighlightRenderer } from "./renderers/MeshHighlightRenderer.ts";
export {
  ObjectOverlayRenderer,
  type ObjectOverlayRendererOptions
} from "./renderers/ObjectOverlayRenderer.ts";
export {
  HighlightPassRenderer,
  type HighlightPassRendererOptions,
  type HighlightPassTarget
} from "./renderers/HighlightPassRenderer.ts";
export type { HighlightOverlay } from "./overlays/HighlightOverlay.ts";
export type {
  HighlightOverlayCreateOptions,
  HighlightOverlayFactory
} from "./overlays/HighlightOverlayFactory.ts";
export {
  HighlightOverlayRegistry,
  type CreateHighlightOverlayOptions,
  type HighlightOverlayRegistryOptions
} from "./overlays/HighlightOverlayRegistry.ts";
export {
  HighlightOutline,
  type HighlightOutlineOptions
} from "./overlays/HighlightOutline.ts";
export {
  HighlightBoundingBox,
  type HighlightBoundingBoxOptions
} from "./overlays/HighlightBoundingBox.ts";
export {
  HighlightSilhouette,
  type HighlightSilhouetteOptions
} from "./overlays/HighlightSilhouette.ts";
export {
  HighlightBoxSilhouette,
  type HighlightBoxSilhouetteOptions
} from "./overlays/HighlightBoxSilhouette.ts";
export {
  HighlightMeshSilhouette,
  type HighlightMeshSilhouetteOptions
} from "./overlays/HighlightMeshSilhouette.ts";
export {
  MergedHighlightOverlay,
  type MergedHighlightOverlayOptions
} from "./overlays/MergedHighlightOverlay.ts";
export {
  HighlightPass,
  type HighlightEntry,
  type HighlightPassOptions
} from "./postprocess/HighlightPass.ts";
export {
  HighlightPassJfa,
  type HighlightPassJfaOptions
} from "./postprocess/HighlightPassJfa.ts";
export {
  createDefaultColorAllocator,
  type PeerColorAllocator
} from "./peer/PeerColorAllocator.ts";
export {
  PeerHighlights,
  type HighlightIndicatorRole,
  type PeerHighlightChangeEventDetail,
  type PeerHighlightsEventMap,
  type PeerHighlightsOptions
} from "./peer/PeerHighlights.ts";
export type { PeerVisibility } from "./peer/PeerVisibility.ts";
export type { PeerSelectionChips } from "./peer/PeerSelectionChips.ts";
