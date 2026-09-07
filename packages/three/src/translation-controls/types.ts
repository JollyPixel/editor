// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { Vector3Like } from "../types.ts";

export type TranslationAxis = "x" | "y" | "z";
export type TranslationDirection = -1 | 1;
export type TranslationDirectionPolicy = "positive" | "negative" | "both";
export type TranslationSpace = "world" | "local";

export interface TranslationArrowHandleOptions {
  kind: "arrow";
  shaftLength?: number;
  shaftRadius?: number;
  headLength?: number;
  headRadius?: number;
  radialSegments?: number;
}

export interface TranslationSphereHandleOptions {
  kind: "sphere";
  shaftLength?: number;
  shaftRadius?: number;
  radius?: number;
  radialSegments?: number;
}

export type TranslationHandleOptions =
  | TranslationArrowHandleOptions
  | TranslationSphereHandleOptions;

export interface TranslationAxisAppearanceOptions {
  color?: THREE.ColorRepresentation;
  directions?: TranslationDirectionPolicy;
  handle?: TranslationHandleOptions;
}

export type TranslationAxisAppearance =
  | false
  | TranslationAxisAppearanceOptions;

export interface TranslationAxesAppearanceOptions {
  x?: TranslationAxisAppearance;
  y?: TranslationAxisAppearance;
  z?: TranslationAxisAppearance;
}

export interface TranslationOutlineOptions {
  color?: THREE.ColorRepresentation;
  opacity?: number;
  scale?: number;
}

export interface TranslationPickerOptions {
  radius?: number;
  lengthScale?: number;
}

export interface TranslationCenterAppearanceOptions {
  color?: THREE.ColorRepresentation;
  radius?: number;
  radialSegments?: number;
  outline?: false | TranslationOutlineOptions;
}

export interface TranslationGizmoAppearanceOptions {
  size?: number;
  gap?: number;
  directions?: TranslationDirectionPolicy;
  handle?: TranslationHandleOptions;
  axes?: TranslationAxesAppearanceOptions;
  center?: false | TranslationCenterAppearanceOptions;
  outline?: false | TranslationOutlineOptions;
  picker?: TranslationPickerOptions;
  hoverColor?: THREE.ColorRepresentation;
  activeColor?: THREE.ColorRepresentation;
  depthTest?: boolean;
  renderOrder?: number;
}

export interface TranslationControlsOptions {
  space?: TranslationSpace;
  snap?: number | Vector3Like | null;
  appearance?: TranslationGizmoAppearanceOptions;
}

export interface TranslationGestureEvent {
  axis: TranslationAxis;
  direction: TranslationDirection;
  position: THREE.Vector3;
  worldPosition: THREE.Vector3;
}

export interface TranslationChangeEvent extends TranslationGestureEvent {
  changed: true;
}

export interface TranslationEndEvent extends TranslationGestureEvent {
  changed: boolean;
}

export interface TranslationControlsEventMap {
  start: TranslationGestureEvent;
  change: TranslationChangeEvent;
  end: TranslationEndEvent;
}
