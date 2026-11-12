// Import Third-party Dependencies
import * as THREE from "three";
import type { Preferences } from "@jolly-pixel/preferences";
import type { SceneComponentOrigin } from "@jolly-pixel/editor.host/scene";

// Import Internal Dependencies
import type { SceneComponents } from "../../components/SceneComponents.ts";
import {
  SCENE_PREFERENCES,
  type ScenePreferences
} from "../../preferences.ts";
import type { SceneBinding } from "../../scene/SceneBinding.ts";

export interface GizmoSnap {
  translate?: number;
  grid?: number;
  rotate?: number;
  scale?: number;
}

export interface ActorSnapSource {
  binding: Pick<SceneBinding, "actorEntry">;
  preferences: Pick<Preferences, "values">;
  components: Pick<SceneComponents, "actorOrigin">;
}

export function gizmoSnap(
  values: ScenePreferences,
  origin: SceneComponentOrigin
): GizmoSnap {
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

export function actorSnap(
  source: ActorSnapSource,
  id: string | null
): GizmoSnap {
  const { binding, preferences, components } = source;
  const entry = id === null ? null : binding.actorEntry(id);
  const origin = entry === null ?
    "center" :
    components.actorOrigin(entry.components.map(({ type }) => type));

  return gizmoSnap(preferences.values(SCENE_PREFERENCES), origin);
}
