// Import Third-party Dependencies
import * as THREE from "three";
import type { SceneComponentOrigin } from "@jolly-pixel/editor.host/scene";
import type { TransformSnapOptions } from "@jolly-pixel/three";

// Import Internal Dependencies
import type { ScenePreferences } from "../../preferences.ts";

export function gizmoSnap(
  values: ScenePreferences,
  origin: SceneComponentOrigin
): TransformSnapOptions {
  if (!values.snap) {
    return {};
  }

  const centered = values.snapTo === "cells" && origin === "center";

  return {
    translate: values.snapMove,
    grid: centered ? values.snapMove / 2 : 0,
    rotate: THREE.MathUtils.degToRad(values.snapRotate),
    scale: values.snapScale
  };
}
