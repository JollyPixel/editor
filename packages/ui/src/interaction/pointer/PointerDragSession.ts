export type PointerDragResult = "commit" | "cancel";

export interface PointerDragSessionOptions {
  element: HTMLElement;
  event: PointerEvent;
  threshold?: number;
  documentClass?: string;
  onStart?(): void;
  onMove(
    clientX: number,
    clientY: number,
    event: PointerEvent
  ): void;
  onFinish(
    result: PointerDragResult,
    started: boolean,
    event: PointerEvent | null
  ): void;
}

export interface PointerDragSessionHandle {
  cancel(): void;
}

/**
 * Owns one pointer gesture from capture through exactly-once settlement.
 */
export function startPointerDragSession(
  options: PointerDragSessionOptions
): PointerDragSessionHandle {
  const {
    element,
    event,
    threshold = 0,
    documentClass,
    onStart,
    onMove,
    onFinish
  } = options;
  const pointerId = event.pointerId;
  const originX = event.clientX;
  const originY = event.clientY;
  let started = false;
  let settled = false;

  function start(): void {
    if (started) {
      return;
    }

    started = true;
    if (documentClass !== undefined) {
      document.documentElement.classList.add(documentClass);
    }
    onStart?.();
  }

  function teardown(): void {
    element.removeEventListener("pointermove", onPointerMove);
    element.removeEventListener("pointerup", onPointerUp);
    element.removeEventListener("pointercancel", onPointerCancel);
    element.removeEventListener("lostpointercapture", onLostPointerCapture);
    document.removeEventListener("keydown", onKeyDown, true);
    if (documentClass !== undefined) {
      document.documentElement.classList.remove(documentClass);
    }

    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  }

  function settle(
    result: PointerDragResult,
    event: PointerEvent | null = null
  ): void {
    if (settled) {
      return;
    }

    settled = true;
    teardown();
    onFinish(result, started, event);
  }

  function onPointerMove(
    moveEvent: PointerEvent
  ): void {
    if (moveEvent.pointerId !== pointerId) {
      return;
    }

    if (!started) {
      const distance = Math.hypot(
        moveEvent.clientX - originX,
        moveEvent.clientY - originY
      );
      if (distance < threshold) {
        return;
      }

      start();
    }

    onMove(moveEvent.clientX, moveEvent.clientY, moveEvent);
  }

  function onPointerUp(
    upEvent: PointerEvent
  ): void {
    if (upEvent.pointerId === pointerId) {
      settle("commit", upEvent);
    }
  }

  function onPointerCancel(
    cancelEvent: PointerEvent
  ): void {
    if (cancelEvent.pointerId === pointerId) {
      settle("cancel", cancelEvent);
    }
  }

  function onLostPointerCapture(
    captureEvent: PointerEvent
  ): void {
    if (captureEvent.pointerId === pointerId) {
      settle("cancel", captureEvent);
    }
  }

  function onKeyDown(
    keyEvent: KeyboardEvent
  ): void {
    if (keyEvent.key !== "Escape") {
      return;
    }

    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    settle("cancel");
  }

  element.setPointerCapture(pointerId);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointercancel", onPointerCancel);
  element.addEventListener("lostpointercapture", onLostPointerCapture);
  document.addEventListener("keydown", onKeyDown, true);

  if (threshold === 0) {
    start();
  }

  return {
    cancel(): void {
      settle("cancel");
    }
  };
}
