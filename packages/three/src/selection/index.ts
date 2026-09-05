export {
  SelectionManager,
  type SelectableObject,
  type SelectionManagerChangeEventDetail,
  type SelectionManagerChangeKind,
  type SelectionManagerEventMap,
  type SelectionManagerOptions,
  type SelectionTechnique
} from "./SelectionManager.ts";
export {
  SelectionAppearance,
  type SelectionAppearanceOptions,
  type SelectionBoundsAppearance,
  type SelectionBoundsAppearanceOptions,
  type SelectionHighlightAppearance,
  type SelectionHighlightAppearanceOptions,
  type SelectionHighlightJfaAppearance,
  type SelectionHighlightJfaAppearanceOptions,
  type SelectionIndicatorAppearance,
  type SelectionIndicatorAppearanceOptions,
  type SelectionOutlineAppearance,
  type SelectionOutlineAppearanceOptions
} from "./SelectionAppearance.ts";
export {
  SelectionResolver,
  type ResolvedSelectionIndicator,
  type SelectionIndicatorRole,
  type SelectionIndicatorSource,
  type SelectionResolverOptions
} from "./SelectionResolver.ts";
export {
  SelectionSystem,
  type SelectionRenderMode,
  type SelectionRendererContext,
  type SelectionRendererFactory,
  type SelectionSystemChangeEventDetail,
  type SelectionSystemChangeKind,
  type SelectionSystemEventMap,
  type SelectionSystemOptions
} from "./SelectionSystem.ts";
export type { SelectionRenderer } from "./renderers/SelectionRenderer.ts";
export {
  ObjectOverlaySelectionRenderer,
  type ObjectOverlaySelectionRendererOptions
} from "./renderers/ObjectOverlaySelectionRenderer.ts";
export {
  HighlightSelectionRenderer,
  type HighlightSelectionRendererOptions,
  type SelectionHighlightTarget
} from "./renderers/HighlightSelectionRenderer.ts";
export type { SelectionOverlay } from "./overlays/SelectionOverlay.ts";
export type {
  SelectionOverlayFactory,
  SelectionOverlayCreateOptions
} from "./overlays/SelectionOverlayFactory.ts";
export {
  SelectionOverlayRegistry,
  type CreateSelectionOverlayOptions,
  type SelectionOverlayRegistryOptions
} from "./overlays/SelectionOverlayRegistry.ts";
export {
  SelectionOutline,
  type SelectionOutlineOptions
} from "./overlays/SelectionOutline.ts";
export {
  SelectionBoundingBox,
  type SelectionBoundingBoxOptions
} from "./overlays/SelectionBoundingBox.ts";
export {
  MergedSelectionOverlay,
  type MergedSelectionOverlayOptions
} from "./overlays/MergedSelectionOverlay.ts";
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
export type { PeerColorAllocator } from "./peer/PeerColorAllocator.ts";
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
