// Import Third-party Dependencies
import * as THREE from "three";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";
import type { SceneTransformPatch } from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import type { SceneBinding } from "../../scene/SceneBinding.ts";
import { roundedVector } from "../../scene/sceneTransform.ts";
import type { SelectionStore } from "../../state/SelectionStore.ts";
import { castActor } from "./actorHit.ts";
import {
  DragPlacement,
  type DragPlane,
  type DragSnap
} from "./DragPlacement.ts";
import {
  DraftGesture,
  type DraftGestureOptions
} from "./DraftGesture.ts";
import {
  actorSnap,
  type ActorSnapSource
} from "./gizmoSnap.ts";

// CONSTANTS
const kDown = new THREE.Vector3(0, -1, 0);
const kGroundHeight = 0;
const kNoSnap: DragSnap = {};
const kTarget = new THREE.Vector3();
const kEye = new THREE.Vector3();

export interface ActorMoveModifiers {
  rest: boolean;
  free: boolean;
}

export interface ActorMoverOptions
  extends Omit<DraftGestureOptions, "onInterrupt">, ActorSnapSource {
  camera: Pick<OrbitFlyCamera, "camera" | "enabled">;
  scene: THREE.Object3D;
  binding: Pick<
    SceneBinding,
    "actor" | "actorEntry" | "findActorId" | "worldBounds"
  >;
  selection: Pick<SelectionStore, "primary">;
}

interface MoveSession {
  object: THREE.Object3D;
  placement: DragPlacement;
  snap: DragSnap;
  last: THREE.Vector3;
}

export class ActorMover {
  #options: ActorMoverOptions;
  #gesture: DraftGesture;
  #session: MoveSession | null = null;
  #raycaster = new THREE.Raycaster();

  cancel = (): void => {
    this.#session = null;
    this.#gesture.cancel();
  };

  constructor(
    options: ActorMoverOptions
  ) {
    this.#options = options;
    this.#gesture = new DraftGesture({
      camera: options.camera,
      document: options.document,
      draft: options.draft,
      onInterrupt: this.cancel
    });
  }

  get dragging(): boolean {
    return this.#session !== null;
  }

  begin(
    aimed: THREE.Raycaster,
    plane: DragPlane
  ): boolean {
    const { selection, scene, binding, camera } = this.#options;
    const id = selection.primary;
    if (id === null || this.#session !== null) {
      return false;
    }

    const hit = castActor(aimed, scene, binding);
    const actor = hit?.id === id ? binding.actor(id) : null;
    if (hit === null || actor === null) {
      return false;
    }

    const object = actor.node.object3D;
    const position = object.getWorldPosition(new THREE.Vector3());
    this.#session = {
      object,
      placement: new DragPlacement({
        plane,
        grab: hit.point,
        eye: camera.camera.getWorldPosition(kEye),
        footprint: {
          position,
          bounds: binding.worldBounds([id])
        }
      }),
      snap: actorSnap(this.#options, id),
      last: position.clone()
    };
    this.#gesture.begin(id);

    return true;
  }

  move(
    aimed: THREE.Raycaster,
    modifiers: ActorMoveModifiers
  ): void {
    const session = this.#session;
    if (session === null) {
      return;
    }

    const { scene, binding } = this.#options;
    const { placement, object } = session;
    const surface = modifiers.rest && placement.canRest ?
      castActor(aimed, scene, binding, object)?.point ?? null :
      null;
    const snap = modifiers.free ? kNoSnap : session.snap;
    if (
      placement.follow(aimed.ray, surface, snap, kTarget) &&
      !kTarget.equals(session.last)
    ) {
      session.last.copy(kTarget);
      this.#gesture.edit(positionPatch(object, kTarget));
    }
  }

  end(): void {
    this.#session = null;
    this.#gesture.end();
  }

  dropToGround(): boolean {
    const { selection, binding, scene, draft } = this.#options;
    const id = selection.primary;
    const actor = id === null ? null : binding.actor(id);
    if (id === null || actor === null || this.#session !== null) {
      return false;
    }

    const object = actor.node.object3D;
    const bounds = binding.worldBounds([id]);
    const center = bounds.getCenter(new THREE.Vector3());
    this.#raycaster.set(center, kDown);
    const floor = castActor(this.#raycaster, scene, binding, object)?.point.y ??
      (center.y >= kGroundHeight ? kGroundHeight : null);
    if (floor === null) {
      return false;
    }

    const position = object.getWorldPosition(new THREE.Vector3());
    position.y += floor - bounds.min.y;
    draft.commitTransform(id, positionPatch(object, position));

    return true;
  }

  dispose(): void {
    this.cancel();
    this.#gesture.dispose();
  }
}

function positionPatch(
  object: THREE.Object3D,
  worldPosition: THREE.Vector3
): SceneTransformPatch {
  const position = worldPosition.clone();
  if (object.parent !== null) {
    object.parent.updateWorldMatrix(true, false);
    object.parent.worldToLocal(position);
  }

  return {
    position: roundedVector(position)
  };
}
