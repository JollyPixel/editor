// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type { ReactiveController, ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import { TransformPanelController, type TransformMode } from "#src/features/transform/TransformPanelController.ts";
import type GroupManager from "#src/features/groups/GroupManager.ts";

class TestHost implements ReactiveControllerHost {
  readonly updateComplete = Promise.resolve(true);
  updateCount = 0;

  addController(
    _controller: ReactiveController
  ): void {
    void _controller;
  }

  removeController(
    _controller: ReactiveController
  ): void {
    void _controller;
  }

  requestUpdate(): void {
    this.updateCount++;
  }
}

interface FakeGroup {
  group: GroupManager;
  calls: Record<string, number>;
  pivotMarkerVisible: boolean | null;
}

function makeFakeGroup(): FakeGroup {
  const state = {
    position: new THREE.Vector3(1, 2, 3),
    positionWorld: new THREE.Vector3(10, 20, 30),
    rotation: new THREE.Euler(0, 0, 0),
    rotationWorld: new THREE.Euler(
      THREE.MathUtils.degToRad(45),
      THREE.MathUtils.degToRad(90),
      0
    ),
    size: new THREE.Vector3(1, 1, 1),
    pivotOffset: new THREE.Vector3(0, 0, 0),
    pivotOffsetWorld: new THREE.Vector3(5, 5, 5),
    scale: new THREE.Vector3(1, 1, 1)
  };
  const calls: Record<string, number> = {};
  function track(
    name: string
  ): void {
    calls[name] = (calls[name] ?? 0) + 1;
  }

  const fakeGroup = {
    getPosition: () => state.position.clone(),
    setPosition: () => track("setPosition"),
    getPositionWorld: () => state.positionWorld.clone(),
    setPositionWorld: () => track("setPositionWorld"),
    getRotation: () => state.rotation.clone(),
    setRotation: () => track("setRotation"),
    getRotationWorld: () => state.rotationWorld.clone(),
    setRotationWorld: () => track("setRotationWorld"),
    getSize: () => state.size.clone(),
    resize: () => track("resize"),
    getPivotOffset: () => state.pivotOffset.clone(),
    setPivotOffset: () => track("setPivotOffset"),
    getPivotOffsetWorld: () => state.pivotOffsetWorld.clone(),
    setPivotOffsetWorld: () => track("setPivotOffsetWorld"),
    getScale: () => state.scale.clone(),
    setScale: () => track("setScale"),
    setPivotMarkerVisible: (visible: boolean) => {
      result.pivotMarkerVisible = visible;
    }
  } as unknown as GroupManager;

  const result: FakeGroup = { group: fakeGroup, calls, pivotMarkerVisible: null };

  return result;
}

function select(
  controller: TransformPanelController,
  group: GroupManager
): void {
  controller.hostConnected();
  document.dispatchEvent(new CustomEvent("groupSelected", { detail: { group } }));
}

describe("TransformPanelController space handling", () => {
  test("reads the world rotation when space is world", () => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(controller, fake.group);

    controller.setMode("angle");
    controller.setSpace("world");

    assert.deepStrictEqual(controller.axisValues, { x: 45, y: 90, z: 0 });
  });

  test("reads the local rotation when space is local", () => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(controller, fake.group);

    controller.setMode("angle");
    controller.setSpace("local");

    assert.deepStrictEqual(controller.axisValues, { x: 0, y: 0, z: 0 });
  });

  test("applies angle edits through the world setter when space is world", () => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(controller, fake.group);

    controller.setMode("angle");
    controller.setSpace("world");
    controller.setAxisValues({ x: 10, y: 20, z: 30 });

    assert.equal(fake.calls.setRotationWorld, 1);
    assert.equal(fake.calls.setRotation, undefined);
  });

  test("applies angle edits through the local setter when space is local", () => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(controller, fake.group);

    controller.setMode("angle");
    controller.setAxisValues({ x: 10, y: 20, z: 30 });

    assert.equal(fake.calls.setRotation, 1);
    assert.equal(fake.calls.setRotationWorld, undefined);
  });
});

describe("TransformPanelController pivot marker visibility", () => {
  const kVisibleModes: TransformMode[] = ["pos", "angle", "size", "pivot"];

  for (const mode of kVisibleModes) {
    test(`shows the pivot marker in ${mode} mode`, () => {
      const controller = new TransformPanelController(new TestHost());
      const fake = makeFakeGroup();
      select(controller, fake.group);

      controller.setMode(mode);

      assert.equal(fake.pivotMarkerVisible, true);
    });
  }

  test("hides the pivot marker in scale mode", () => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(controller, fake.group);

    controller.setMode("scale");

    assert.equal(fake.pivotMarkerVisible, false);
  });
});
