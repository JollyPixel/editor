// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";

// Import Internal Dependencies
import GizmoManager from "#src/features/transform/GizmoManager.ts";
import type GroupManager from "#src/features/groups/GroupManager.ts";

function makeFakeCamera(): OrbitFlyCamera {
  return {
    threeCamera: new THREE.PerspectiveCamera(),
    enabled: true
  } as unknown as OrbitFlyCamera;
}

function makeFakeGroup(
  uuid: string
): GroupManager {
  return {
    getGroupUUID: () => uuid,
    getGroup: () => new THREE.Object3D(),
    getPivot: () => new THREE.Object3D(),
    getMesh: () => new THREE.Object3D(),
    roundTransform: () => undefined
  } as unknown as GroupManager;
}

function dragTo(
  gizmo: GizmoManager,
  value: boolean
): void {
  gizmo.transformControl.dispatchEvent({ type: "dragging-changed", value } as never);
}

describe("GizmoManager transform lock", () => {
  test("refuses to attach when the selected group is remotely locked", () => {
    const gizmo = new GizmoManager({
      camera: makeFakeCamera(),
      canvas: document.createElement("canvas"),
      getSelectedGroup: () => makeFakeGroup("uuid-1"),
      commitTransform: () => undefined,
      isRemotelyLocked: () => true
    });

    gizmo.setMode({ mode: "translate", target: "group" });

    assert.equal(gizmo.transformControl.enabled, false);
  });

  test("attaches normally when the selected group is not locked", () => {
    const gizmo = new GizmoManager({
      camera: makeFakeCamera(),
      canvas: document.createElement("canvas"),
      getSelectedGroup: () => makeFakeGroup("uuid-1"),
      commitTransform: () => undefined,
      isRemotelyLocked: () => false
    });

    gizmo.setMode({ mode: "translate", target: "group" });

    assert.equal(gizmo.transformControl.enabled, true);
  });

  test("claims the transform lock as soon as a drag starts", () => {
    const claims: string[] = [];
    const gizmo = new GizmoManager({
      camera: makeFakeCamera(),
      canvas: document.createElement("canvas"),
      getSelectedGroup: () => makeFakeGroup("uuid-1"),
      commitTransform: () => undefined,
      claimTransformLock: (uuid) => claims.push(uuid)
    });

    dragTo(gizmo, true);

    assert.deepEqual(claims, ["uuid-1"]);
  });

  test("commits the transform once a drag ends", () => {
    const commits: string[] = [];
    const gizmo = new GizmoManager({
      camera: makeFakeCamera(),
      canvas: document.createElement("canvas"),
      getSelectedGroup: () => makeFakeGroup("uuid-1"),
      commitTransform: (uuid) => commits.push(uuid)
    });

    dragTo(gizmo, true);
    dragTo(gizmo, false);

    assert.deepEqual(commits, ["uuid-1"]);
  });
});
