export {
  MeshHighlightState,
  type HighlightTechnique,
  type MeshHighlightStateChangeEventDetail,
  type MeshHighlightStateChangeKind,
  type MeshHighlightStateEventMap,
  type MeshHighlightStateOptions,
  type SelectableObject
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
export {
  HighlightResolver,
  type HighlightIndicatorRole,
  type HighlightIndicatorSource,
  type HighlightResolverOptions,
  type ResolvedHighlightIndicator
} from "./HighlightResolver.ts";
export {
  MeshHighlight,
  type MeshHighlightChangeEventDetail,
  type MeshHighlightChangeKind,
  type MeshHighlightEventMap,
  type MeshHighlightMode,
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
  PeerHighlightPass,
  type HighlightTarget,
  type PeerHighlightPassOptions
} from "./postprocess/PeerHighlightPass.ts";
export {
  createDefaultColorAllocator,
  type PeerColorAllocator
} from "./peer/PeerColorAllocator.ts";
export {
  PeerSelectionRegistry,
  type PeerSelectionChangeEventDetail,
  type PeerSelectionRegistryEventMap,
  type PeerSelectionRegistryOptions
} from "./peer/PeerSelectionRegistry.ts";
export {
  PeerSelectionOverlays,
  type PeerSelectionOverlaysOptions
} from "./peer/PeerSelectionOverlays.ts";
export {
  PeerSelectionVisibility,
  type PeerSelectionVisibilityOptions
} from "./peer/PeerSelectionVisibility.ts";
export {
  PeerSelectionChips,
  type PeerSelectionChipsOptions
} from "./peer/PeerSelectionChips.ts";
export {
  PeerHoverRegistry,
  type PeerHoverChangeEventDetail,
  type PeerHoverRegistryEventMap,
  type PeerHoverRegistryOptions
} from "./peer/PeerHoverRegistry.ts";
export {
  PeerHoverOverlays,
  type PeerHoverOverlaysOptions
} from "./peer/PeerHoverOverlays.ts";
