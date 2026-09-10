// CONSTANTS
const kDraggingClass = "jolly-tree-dragging";

export interface RowDragOptions {
  element: HTMLElement;
  threshold: number;
}

export interface RowDragCallbacks {
  onArm(): void;
  onMove(
    clientX: number,
    clientY: number
  ): void;
  onFinish(
    commit: boolean
  ): void;
}

export function beginRowDrag(
  event: PointerEvent,
  options: RowDragOptions,
  callbacks: RowDragCallbacks
): void {
  const { element, threshold } = options;
  const { onArm, onMove, onFinish } = callbacks;
  const pointerId = event.pointerId;
  const originX = event.clientX;
  const originY = event.clientY;
  let armed = false;

  function arm(): void {
    armed = true;
    element.setPointerCapture(pointerId);
    document.documentElement.classList.add(kDraggingClass);
    onArm();
  }

  function onPointerMove(
    moveEvent: PointerEvent
  ): void {
    if (moveEvent.pointerId !== pointerId) {
      return;
    }
    if (!armed) {
      const distance = Math.hypot(
        moveEvent.clientX - originX,
        moveEvent.clientY - originY
      );
      if (distance < threshold) {
        return;
      }
      arm();
    }
    onMove(moveEvent.clientX, moveEvent.clientY);
  }

  function onKeyDown(
    keyEvent: KeyboardEvent
  ): void {
    if (keyEvent.key !== "Escape") {
      return;
    }
    keyEvent.preventDefault();
    finish(false);
  }

  function finish(
    commit: boolean
  ): void {
    element.removeEventListener("pointermove", onPointerMove);
    element.removeEventListener("pointerup", onPointerUp);
    element.removeEventListener("pointercancel", onPointerCancel);
    document.removeEventListener("keydown", onKeyDown, true);
    if (!armed) {
      return;
    }

    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
    document.documentElement.classList.remove(kDraggingClass);
    onFinish(commit);
  }

  function onPointerUp(
    upEvent: PointerEvent
  ): void {
    if (upEvent.pointerId === pointerId) {
      finish(true);
    }
  }
  function onPointerCancel(
    cancelEvent: PointerEvent
  ): void {
    if (cancelEvent.pointerId === pointerId) {
      finish(false);
    }
  }

  if (threshold === 0) {
    arm();
  }
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointercancel", onPointerCancel);
  document.addEventListener("keydown", onKeyDown, true);
}
