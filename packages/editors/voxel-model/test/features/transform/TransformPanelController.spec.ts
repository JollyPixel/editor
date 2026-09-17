// Import Node.js Dependencies
import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type { ReactiveController, ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import {
  TransformPanelController,
  type TransformMode
} from "#src/features/transform/TransformPanelController.ts";
import type GroupManager from "#src/features/groups/GroupManager.ts";
import type { ModelSceneComponent } from "#src/app/ModelSceneComponent.ts";
import type { PeerMark } from "#src/collaboration/peerMarks.ts";
import { editorState } from "#src/app/state/index.ts";

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
    getGroupUUID: () => "fake-uuid",
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
  t: TestContext,
  controller: TransformPanelController,
  group: GroupManager
): void {
  controller.hostConnected();
  t.after(() => controller.hostDisconnected());
  editorState.modelEvents.emit("groupSelected", { group });
}

describe("TransformPanelController space handling", () => {
  test("reads the world rotation when space is world", (t) => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(t, controller, fake.group);

    controller.setMode("angle");
    controller.setSpace("world");

    assert.deepStrictEqual(controller.axisValues, { x: 45, y: 90, z: 0 });
  });

  test("reads the local rotation when space is local", (t) => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(t, controller, fake.group);

    controller.setMode("angle");
    controller.setSpace("local");

    assert.deepStrictEqual(controller.axisValues, { x: 0, y: 0, z: 0 });
  });

  test("applies angle edits through the world setter when space is world", (t) => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(t, controller, fake.group);

    controller.setMode("angle");
    controller.setSpace("world");
    controller.setAxisValues({ x: 10, y: 20, z: 30 });

    assert.equal(fake.calls.setRotationWorld, 1);
    assert.equal(fake.calls.setRotation, undefined);
  });

  test("applies angle edits through the local setter when space is local", (t) => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(t, controller, fake.group);

    controller.setMode("angle");
    controller.setAxisValues({ x: 10, y: 20, z: 30 });

    assert.equal(fake.calls.setRotation, 1);
    assert.equal(fake.calls.setRotationWorld, undefined);
  });
});

describe("TransformPanelController pivot marker visibility", () => {
  const kVisibleModes: TransformMode[] = ["pos", "angle", "size", "pivot"];

  for (const mode of kVisibleModes) {
    test(`shows the pivot marker in ${mode} mode`, (t) => {
      const controller = new TransformPanelController(new TestHost());
      const fake = makeFakeGroup();
      select(t, controller, fake.group);

      controller.setMode(mode);

      assert.equal(fake.pivotMarkerVisible, true);
    });
  }

  test("hides the pivot marker in scale mode", (t) => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(t, controller, fake.group);

    controller.setMode("scale");

    assert.equal(fake.pivotMarkerVisible, false);
  });
});

interface FakeLock {
  lockedByResult: PeerMark | null;
  claims: string[];
  releaseCount: number;
  onChangeListeners: Set<() => void>;
  fireChange(): void;
}

function makeFakeLock(): FakeLock {
  const fake: FakeLock = {
    lockedByResult: null,
    claims: [],
    releaseCount: 0,
    onChangeListeners: new Set(),
    fireChange() {
      for (const listener of fake.onChangeListeners) {
        listener();
      }
    }
  };

  return fake;
}

interface FakeSceneManagerStats {
  gizmoModeCalls: number;
  commitCalls: string[];
}

function makeFakeSceneManager(
  fakeLock: FakeLock
): { sceneManager: ModelSceneComponent; stats: FakeSceneManagerStats; } {
  const stats: FakeSceneManagerStats = { gizmoModeCalls: 0, commitCalls: [] };

  const sceneManager = {
    setGizmoMode: () => {
      stats.gizmoModeCalls++;
    },
    getModelManager: () => {
      return {
        commitGroupTransform: (uuid: string) => stats.commitCalls.push(uuid)
      };
    },
    getTransformLock: () => {
      return {
        lockedBy: () => fakeLock.lockedByResult,
        claim: (uuid: string) => fakeLock.claims.push(uuid),
        release: () => {
          fakeLock.releaseCount++;
        },
        watch: (_event: "change", listener: () => void) => {
          void _event;
          fakeLock.onChangeListeners.add(listener);

          return () => fakeLock.onChangeListeners.delete(listener);
        }
      };
    }
  } as unknown as ModelSceneComponent;

  return { sceneManager, stats };
}

describe("TransformPanelController transform lock", () => {
  test("is disabled once a remote peer holds the lock on the selected block", (t) => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(t, controller, fake.group);
    const fakeLock = makeFakeLock();
    const { sceneManager } = makeFakeSceneManager(fakeLock);
    controller.attach(sceneManager);

    fakeLock.lockedByResult = { clientId: "bob", displayName: "Bob", color: "#000000" };

    assert.equal(controller.disabled, true);
  });

  test("is enabled when the lock resolves to no remote holder", (t) => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(t, controller, fake.group);
    const fakeLock = makeFakeLock();
    const { sceneManager } = makeFakeSceneManager(fakeLock);
    controller.attach(sceneManager);

    assert.equal(controller.disabled, false);
  });

  test("does not mutate the group when locked, even if asked to", (t) => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(t, controller, fake.group);
    const fakeLock = makeFakeLock();
    fakeLock.lockedByResult = { clientId: "bob", displayName: "Bob", color: "#000000" };
    const { sceneManager, stats } = makeFakeSceneManager(fakeLock);
    controller.attach(sceneManager);

    controller.setMode("pos");
    controller.setAxisValues({ x: 9, y: 9, z: 9 });

    assert.equal(fake.calls.setPosition, undefined);
    assert.deepEqual(stats.commitCalls, []);
  });

  test("claims the lock before mutating and releases it after commit", (t) => {
    const controller = new TransformPanelController(new TestHost());
    const fake = makeFakeGroup();
    select(t, controller, fake.group);
    const fakeLock = makeFakeLock();
    const { sceneManager, stats } = makeFakeSceneManager(fakeLock);
    controller.attach(sceneManager);

    controller.setMode("pos");
    controller.setAxisValues({ x: 9, y: 9, z: 9 });

    assert.deepEqual(fakeLock.claims, ["fake-uuid"]);
    assert.deepEqual(stats.commitCalls, ["fake-uuid"]);
    assert.equal(fakeLock.releaseCount, 1);
  });

  test("re-syncs the gizmo mode and requests an update when the lock changes", (t) => {
    const host = new TestHost();
    const controller = new TransformPanelController(host);
    const fake = makeFakeGroup();
    select(t, controller, fake.group);
    const fakeLock = makeFakeLock();
    const { sceneManager, stats } = makeFakeSceneManager(fakeLock);
    controller.attach(sceneManager);
    const gizmoModeCallsBeforeChange = stats.gizmoModeCalls;
    const updateCountBeforeChange = host.updateCount;

    fakeLock.fireChange();

    assert.ok(stats.gizmoModeCalls > gizmoModeCallsBeforeChange);
    assert.ok(host.updateCount > updateCountBeforeChange);
  });
});
