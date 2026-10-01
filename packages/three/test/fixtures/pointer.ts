// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kViewportSize = 200;

export function createPointerTarget(
  size = kViewportSize
): HTMLElement {
  const element = document.createElement("div");
  const rect = {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: size,
    bottom: size,
    width: size,
    height: size,
    toJSON: () => {
      return {};
    }
  } as DOMRect;
  element.getBoundingClientRect = () => rect;

  return element;
}

export interface PointerAtOptions {
  camera: THREE.Camera;
  element: HTMLElement;
  target: THREE.Vector3;
  type: "pointerdown" | "pointermove" | "pointerup";
  pointerId?: number;
  altKey?: boolean;
  shiftKey?: boolean;
  button?: number;
}

export function pointerAt(
  options: PointerAtOptions
): PointerEvent {
  const {
    camera,
    element,
    target,
    type,
    pointerId = 1,
    altKey = false,
    shiftKey = false,
    button = 0
  } = options;

  const rect = element.getBoundingClientRect();
  const ndc = target.clone().project(camera);

  return new window.PointerEvent(type, {
    clientX: ((ndc.x + 1) / 2) * rect.width,
    clientY: ((1 - ndc.y) / 2) * rect.height,
    pointerId,
    button,
    altKey,
    shiftKey,
    bubbles: true
  });
}
