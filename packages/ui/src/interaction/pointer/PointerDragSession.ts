export type PointerDragResult = "commit" | "cancel";

export interface PointerDragSessionOptions {
  element: HTMLElement;
  event: PointerEvent;
  threshold?: number;
  documentClass?: string;
  elementAttribute?: string;
  /**
   * Swallows the click the browser fires on release once the gesture started.
   */
  suppressClick?: boolean;
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

export function startPointerDragSession(
  options: PointerDragSessionOptions
): PointerDragSessionHandle {
  const {
    element,
    event,
    threshold = 0,
    documentClass,
    elementAttribute,
    suppressClick = false,
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
    if (elementAttribute !== undefined) {
      element.setAttribute(elementAttribute, "");
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
    if (elementAttribute !== undefined) {
      element.removeAttribute(elementAttribute);
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
    if (started && suppressClick) {
      swallowNextClick();
    }
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

function swallowNextClick(): void {
  function onClick(
    clickEvent: MouseEvent
  ): void {
    if (clickEvent.detail === 0) {
      return;
    }

    clickEvent.preventDefault();
    clickEvent.stopImmediatePropagation();
    disarm();
  }

  function disarm(): void {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointerdown", disarm, true);
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerdown", disarm, true);
}
