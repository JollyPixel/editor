// Import Internal Dependencies
export {
  Brush,
  type BrushOptions
} from "./tools/Brush.ts";
export type { BrushTool } from "./tools/BrushController.ts";
export type { FillTool } from "./tools/FillController.ts";
export type {
  SelectControllerEvent,
  SelectionProgressEvent,
  SelectTool
} from "./tools/SelectController.ts";
export type { Toolset } from "./tools/Tools.ts";
export {
  PixelArtCanvas,
  type HistoryState,
  type PixelArtCanvasOptions,
  type Mode
} from "./PixelArtCanvas.ts";
export {
  PixelBuffer,
  type PixelBufferOptions
} from "./buffer/PixelBuffer.ts";
export type { DefaultPixelBuffer } from "./buffer/types.ts";
export type {
  PixelBufferHookAction,
  PixelBufferHookEvent,
  PixelBufferHookListener
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
  HistoryUvStateEntry
} from "./history/HistoryStack.types.ts";
export type {
  DefaultViewport
} from "./rendering/Viewport.ts";
export { PeerPresence } from "./rendering/presence/PeerPresence.ts";
export {
  Zoom,
  type ZoomOptions
} from "./rendering/Zoom.ts";
export type {
  ColorInput,
  PeerStrokePixel,
  RGBA,
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
export {
  decodeRasterBlob,
  decodeRasterCanvas
} from "./clipboard/selectionImage.ts";
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
  type UVFaceGeometryTemplate,
  type UVRegionCreateOptions
} from "./uv/UVMap.ts";
export {
  UVRegion,
  UV_FACES,
  type UVFace,
  type UVGeometry,
  type UVRegionData,
  type UVRegionFace,
  type UVRegionState,
  type UVTriangle,
  type UVTriangleCorner
} from "./uv/UVRegion.ts";
export { UVRegionCollection } from "./uv/UVRegionCollection.ts";
// PixelSyncServer is deliberately not re-exported here: it value-imports
// @jolly-pixel/network's server root (worker_threads and friends), and this
// barrel is consumed by browser bundles. Import it from
// "@jolly-pixel/pixel-draw.renderer/network/index.ts" instead.
export type {
  PixelBufferSnapshot,
  PixelNetworkCommand,
  PixelServerMessage,
  SelectionGhostPayload,
  UVGhostPayload
} from "./network/types.ts";
export { applyCommandToBuffer } from "./network/PixelCommandApplier.ts";
export type {
  PixelSyncClientOptions
} from "./network/PixelSyncClient.ts";
export { PixelSyncClient } from "./network/PixelSyncClient.ts";
export type {
  PixelCursorSyncOptions
} from "./network/PixelCursorSync.ts";
export { PixelCursorSync } from "./network/PixelCursorSync.ts";
export type {
  PixelStrokeGhostSyncOptions
} from "./network/PixelStrokeGhostSync.ts";
export { PixelStrokeGhostSync } from "./network/PixelStrokeGhostSync.ts";
export type {
  UVGhostSyncOptions
} from "./network/UVGhostSync.ts";
export { UVGhostSync } from "./network/UVGhostSync.ts";
export type {
  SelectionGhostSyncOptions
} from "./network/SelectionGhostSync.ts";
export { SelectionGhostSync } from "./network/SelectionGhostSync.ts";
