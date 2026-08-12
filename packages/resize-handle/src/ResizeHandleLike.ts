/**
 * Shared contract for ResizeHandle and CornerResizeHandle, so callers that
 * only need to listen for drag events and dispose can treat single-axis and
 * diagonal handles the same way.
 */
export interface ResizeHandleLike extends EventTarget {
  dispose(): void;
}
