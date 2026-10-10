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
export * from "./selection/SelectionPresence.ts";
export type { Toolset } from "./tools/Tools.ts";
export type { UVTool } from "./tools/uv/UVController.ts";
export * from "./PixelArtCanvas.ts";
export * from "./PixelDocument.ts";
export type { UVRegionFilter } from "./sync/UVOwnership.ts";
export * from "./sync/PixelDocumentState.ts";
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
  PixelChange,
  SelectionEdit
} from "./sync/LocalEdit.types.ts";
export type { EditGrouping } from "./sync/EditRecorder.ts";
export * from "./sync/EditChange.ts";
export type {
  PixelArtCanvasHistory,
  PixelHistoryBinding,
  PixelHistoryState,
  PixelHistoryTarget
} from "./history/CanvasHistory.ts";
export type { CanvasBufferEvent } from "./buffer/CanvasBuffer.ts";
export * from "./buffer/PixelBuffer.ts";
export type * from "./buffer/types.ts";
export * from "./buffer/fromPng.ts";
export * from "./serialization/index.ts";
export * from "./normal/NormalMap.ts";
export * from "./normal/NormalMapConfig.ts";
export * from "./normal/errors/InvalidNormalMapSettingsError.ts";
export * from "./normal/NormalMapGenerator.ts";
export * from "./normal/IslandMap.ts";
export * from "./normal/types.ts";
export {
  isNormalMapCommand,
  type NormalMapCommandAction
} from "./sync/normalMapCommands.ts";
export type * from "./selection/SelectionFootprint.ts";
export type {
  CanvasViewport,
  ClientOrigin,
  DefaultViewport,
  ScreenProjection
} from "./rendering/Viewport.ts";
export { PeerPresence } from "./rendering/presence/PeerPresence.ts";
export * from "./rendering/Zoom.ts";
export type {
  ByteColorInput,
  PeerStrokePixel,
  RGBA8,
  RotationDirection,
  SelectionRect,
  Vec2
} from "./types.ts";
export type * from "./input/CanvasShortcuts.ts";
export type * from "./input/WindowLike.ts";
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
export * from "./tools/selectionPlacement.ts";
export * from "./uv/map/UVMap.ts";
export * from "./uv/region/UVRegion.ts";
export * from "./buffer/colorGroups.ts";
export * from "./tools/Fill.ts";
export {
  isVec2,
  vec2Equal
} from "./utils/math.ts";
export * from "./utils/RectArea.ts";
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
export * from "./uv/region/UVTarget.ts";
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
export * from "./palette/ColorPalette.ts";
