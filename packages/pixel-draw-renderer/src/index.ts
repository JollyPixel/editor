// Import Internal Dependencies
export {
  Brush,
  type BrushColorSlot,
  type BrushOptions,
  type BrushPaintSource
} from "./tools/Brush.ts";
export type { BrushTool } from "./tools/BrushEngine.ts";
export type { FillTool } from "./tools/FillEngine.ts";
export type {
  SelectEngineEvent,
  SelectionProgressEvent,
  SelectTool
} from "./tools/SelectEngine.ts";
export type { Toolset } from "./tools/Tools.ts";
export type { UVTool } from "./tools/uv/UVController.ts";
export {
  PixelArtCanvas,
  type HistoryState,
  type PixelArtCanvasOptions,
  type ClearTextureOptions,
  type Mode,
  type TextureView
} from "./PixelArtCanvas.ts";
export {
  PixelDocument,
  type PixelDocumentEvent,
  type PixelDocumentOptions
} from "./PixelDocument.ts";
export type { UVRegionFilter } from "./sync/UVOwnership.ts";
export {
  PixelDocumentState,
  type NormalMapChangedListener,
  type PixelDocumentSnapshot,
  type PixelDocumentStateOptions
} from "./sync/PixelDocumentState.ts";
export {
  toDocumentCommand,
  toPixelCommand,
  type DocumentCommand,
  type NormalMapCommand,
  type PixelCommand,
  type PixelCommandAction,
  type UVRegionRotation
} from "./sync/PixelCommand.ts";
export type {
  GlobalFill,
  SelectionEdit
} from "./sync/LocalEdit.types.ts";
export type { CanvasBufferEvent } from "./buffer/CanvasBuffer.ts";
export {
  PixelBuffer,
  type PixelBufferOptions
} from "./buffer/PixelBuffer.ts";
export type { DefaultPixelBuffer } from "./buffer/types.ts";
export {
  createPixelBufferFromPng,
  type PixelBufferFromPngOptions
} from "./buffer/fromPng.ts";
export {
  createPixelArtDocument,
  decodePixelArtDocument,
  encodePixelArtDocument,
  InvalidPixelArtDocumentError,
  parsePixelArtDocument,
  pixelArtSnapshot,
  serializePixelDocument,
  deserializePixelDocument,
  encodePixelBytes,
  decodePixelBytes,
  encodePngPixels,
  decodePngPixels,
  PIXEL_ART_DOCUMENT_VERSION,
  type PixelArtDocumentData,
  type PixelBufferSnapshot,
  type PngPixels
} from "./serialization/index.ts";
export {
  NormalMap,
  type NormalMapEvent,
  type NormalMapSource
} from "./normal/NormalMap.ts";
export {
  NormalMapConfig,
  DEFAULT_NORMAL_MAP_SETTINGS
} from "./normal/NormalMapConfig.ts";
export {
  InvalidNormalMapSettingsError
} from "./normal/errors/InvalidNormalMapSettingsError.ts";
export { NormalMapGenerator } from "./normal/NormalMapGenerator.ts";
export { IslandMap } from "./normal/IslandMap.ts";
export {
  NORMAL_MAP_BEVEL_PROFILES,
  NORMAL_MAP_BORDERS,
  NORMAL_MAP_HEIGHTS,
  type IndexedNormalMapZone,
  type Island,
  type IslandFace,
  type NormalMapBevel,
  type NormalMapBevelProfile,
  type NormalMapBorder,
  type NormalMapData,
  type NormalMapHeight,
  type NormalMapInput,
  type NormalMapSettings,
  type NormalMapZone,
  type ResolvedNormalMapSettings
} from "./normal/types.ts";
export {
  isNormalMapCommand,
  type NormalMapCommandAction
} from "./sync/normalMapCommands.ts";
export {
  HistoryStack,
  type HistoryStackOptions
} from "./history/HistoryStack.ts";
export type {
  HistoryEdit,
  HistoryEntry,
  SelectionChange,
  SelectionFootprint
} from "./history/HistoryEntry.ts";
export type {
  CanvasViewport,
  ClientOrigin,
  DefaultViewport,
  ScreenProjection
} from "./rendering/Viewport.ts";
export { PeerPresence } from "./rendering/presence/PeerPresence.ts";
export {
  Zoom,
  type ZoomOptions
} from "./rendering/Zoom.ts";
export type {
  ByteColorInput,
  PeerStrokePixel,
  RGBA8,
  RotationDirection,
  SelectionRect,
  Vec2
} from "./types.ts";
export type { CanvasShortcuts } from "./input/CanvasShortcuts.ts";
export type { WindowLike } from "./input/WindowLike.ts";
export { decodeRasterBlob } from "./clipboard/selectionImage.ts";
export type {
  ClipboardAdapter,
  ClipboardOperationResult,
  ClipboardOperation,
  ClipboardResultCode,
  ClipboardSource,
  DecodedSelection,
  SelectionSnapshot
} from "./clipboard/types.ts";
export {
  placeSelection,
  type SelectionPlacementOptions
} from "./tools/selectionPlacement.ts";
export {
  UVMap,
  type UVMapEvent,
  type UVMapEventType,
  type UVMapListener,
  type UVMapOptions,
  type UVLabelScope,
  type UVSlotGeometryTemplate,
  type UVSlotSize,
  type UVRegionCreateOptions
} from "./uv/map/UVMap.ts";
export {
  UVRegion,
  DEFAULT_UV_SLOTS,
  type UVSlot,
  type UVGeometry,
  type UVLayoutData,
  type UVRegionData,
  type UVRegionIdentity,
  type UVRegionSlot,
  type UVResizeOptions,
  type UVRegionState,
  type UVMovementScope,
  type UVQuarterTurn,
  type UVRect,
  type UVTriangle,
  type UVTriangleCorner,
  type UVCompound,
  type UVCompoundPart,
  type UVNormalizedRect
} from "./uv/region/UVRegion.ts";
export {
  groupPositionsByColor,
  type ColorGroup
} from "./buffer/colorGroups.ts";
export { Fill } from "./tools/Fill.ts";
export {
  isVec2,
  vec2Equal
} from "./utils/math.ts";
export {
  rectOf,
  rotateCorner,
  rotateGeometry,
  rotateUv,
  rotationOf,
  triangleCornerOf,
  withRotation
} from "./uv/geometry/geometry.ts";
export {
  isUVGeometry,
  isUVLayoutData,
  isUVQuarterTurn,
  isUVRegionData,
  isUVSlot,
  isUVTextureRect
} from "./uv/region/validation.ts";
export {
  uvTargetKey,
  type UVTarget
} from "./uv/region/UVTarget.ts";
export type {
  PeerSelectionOutlineState
} from "./rendering/presence/PeerSelectionOutlines.ts";
export type {
  PeerFloatingSelectionState
} from "./rendering/presence/PeerFloatingSelections.ts";
export type {
  PeerUVPreviewState
} from "./rendering/presence/PeerUVPreview.ts";
export type {
  PeerUVSelectionState
} from "./rendering/presence/PeerUVSelections.ts";
