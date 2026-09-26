// Import Internal Dependencies
export {
  Brush,
  type BrushColorSlot,
  type BrushOptions,
  type BrushPaintSource
} from "./tools/Brush.ts";
export type { BrushTool } from "./tools/BrushEngine.ts";
export type {
  FillGlobalCommit,
  FillTool
} from "./tools/FillEngine.ts";
export type {
  SelectEditEntry,
  SelectEngineEvent,
  SelectionProgressEvent,
  SelectTool
} from "./tools/SelectEngine.ts";
export type { Toolset } from "./tools/Tools.ts";
export {
  PixelArtCanvas,
  type HistoryState,
  type PixelArtCanvasOptions,
  type ClearTextureOptions,
  type Mode
} from "./PixelArtCanvas.ts";
export {
  PixelDocument,
  type PixelDocumentEvent,
  type PixelDocumentOptions
} from "./PixelDocument.ts";
export type { UVRegionFilter } from "./sync/DocumentEdits.ts";
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
  serializePixelBuffer,
  deserializePixelBuffer,
  encodePixelBytes,
  decodePixelBytes,
  PIXEL_ART_DOCUMENT_VERSION,
  type PixelArtDocumentData,
  type PixelBufferSnapshot
} from "./serialization/index.ts";
export type {
  PixelBufferHookAction,
  PixelBufferHookEvent,
  PixelBufferHookListener,
  UVRegionRotation
} from "./buffer/hooks.ts";
export {
  HistoryStack,
  type HistoryStackOptions
} from "./history/HistoryStack.ts";
export type {
  HistoryEntry,
  HistoryEntryInput,
  HistoryResizedEntry,
  HistorySelectEditEntry,
  HistoryStrokeEntry,
  HistoryTextureReplacedEntry,
  HistoryUvCreateEntry,
  HistoryUvDeleteEntry,
  HistoryUvMoveEntry,
  HistoryUvRotateEntry,
  HistoryUvStateEntry
} from "./history/HistoryStack.types.ts";
export type {
  CanvasViewport,
  ClientOrigin,
  DefaultViewport
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
export {
  DEFAULT_KEYBINDINGS,
  Keybindings,
  type Keybinding,
  type KeybindingAction,
  type KeybindingsMap
} from "./input/Keybindings.ts";
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
export { InvalidKeybindingError } from "./input/errors/InvalidKeybindingError.ts";
export { KeybindingConflictError } from "./input/errors/KeybindingConflictError.ts";
export {
  UVMap,
  type UVMapEvent,
  type UVMapEventType,
  type UVMapListener,
  type UVMapOptions,
  type UVSlotGeometryTemplate,
  type UVSlotSize,
  type UVRegionCreateOptions
} from "./uv/UVMap.ts";
export {
  UVRegion,
  DEFAULT_UV_SLOTS,
  type UVSlot,
  type UVGeometry,
  type UVLayoutData,
  type UVRegionData,
  type UVRegionIdentity,
  type UVRegionSlot,
  type UVRegionState,
  type UVMovementScope,
  type UVQuarterTurn,
  type UVRect,
  type UVTriangle,
  type UVTriangleCorner,
  type UVCompound,
  type UVCompoundPart,
  type UVNormalizedRect
} from "./uv/UVRegion.ts";
export { UVRegionCollection } from "./uv/UVRegionCollection.ts";
export {
  applyColorGroups,
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
} from "./uv/geometry.ts";
export {
  isUVGeometry,
  isUVQuarterTurn,
  isUVRegionData,
  isUVSlot,
  isUVTextureRect
} from "./uv/validation.ts";
export {
  uvTargetKey,
  type UVTarget
} from "./uv/UVTarget.ts";
export type {
  PeerSelectionOutlineState
} from "./rendering/presence/PeerSelectionOutlines.ts";
export type {
  PeerFloatingSelectionState
} from "./rendering/presence/PeerFloatingSelections.ts";
export type {
  PeerUVPreviewState
} from "./rendering/presence/PeerUVPreview.ts";
