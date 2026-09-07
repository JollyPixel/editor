// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  TranslationControls,
  type TranslationAxis,
  type TranslationDirection,
  type TranslationEndEvent
} from "#src/index.ts";
import {
  createPointerTarget,
  pointerAt
} from "../fixtures/pointer.ts";

interface ControlsHarness {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  element: HTMLElement;
  target: THREE.Object3D;
  controls: TranslationControls;
  pointOnHandle(
    axis: TranslationAxis,
    direction?: TranslationDirection
  ): THREE.Vector3;
  send(
    type: "pointerdown" | "pointermove" | "pointerup",
    point: THREE.Vector3,
    options?: {
      altKey?: boolean;
      button?: number;
      pointerId?: number;
    }
  ): void;
}

function createHarness(
  options: ConstructorParameters<typeof TranslationControls>[2] = {}
): ControlsHarness {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(5, 4, 7);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  const element = createPointerTarget();
  const target = new THREE.Object3D();
  const controls = new TranslationControls(camera, element, options);
  scene.add(target, controls.helper);
  controls.attach(target);
  scene.updateMatrixWorld(true);

  const harness: ControlsHarness = {
    scene,
    camera,
    element,
    target,
    controls,
    pointOnHandle(
      axis: TranslationAxis,
      direction: TranslationDirection = 1
    ): THREE.Vector3 {
      scene.updateMatrixWorld(true);
      const handle = controls.helper.getObjectByName(
        `translation-handle-${axis}-${direction === 1 ? "positive" : "negative"}`
      );
      assert.ok(handle, `missing ${axis} handle`);
      const picker = handle.getObjectByName(
        "translation-handle-picker"
      ) as THREE.Mesh<THREE.BufferGeometry> | undefined;
      assert.ok(picker, `missing ${axis} picker`);
      picker.geometry.computeBoundingBox();
      const center = picker.geometry.boundingBox!.getCenter(
        new THREE.Vector3()
      );

      return picker.localToWorld(center);
    },
    send(
      type,
      point,
      eventOptions = {}
    ): void {
      element.dispatchEvent(pointerAt({
        camera,
        element,
        target: point,
        type,
        pointerId: eventOptions.pointerId,
        button: eventOptions.button,
        altKey: eventOptions.altKey
      }));
    }
  };

  return harness;
}

function handles(
  controls: TranslationControls
): THREE.Object3D[] {
  return controls.helper.children.filter(
    (child) => child.type === "TranslationHandle"
  );
}

describe("appearance", () => {
  test("draws one positive outlined handle per axis by default", () => {
    const harness = createHarness();
    const renderedHandles = handles(harness.controls);

    assert.deepEqual(
      renderedHandles.map((handle) => handle.name),
      [
        "translation-handle-x-positive",
        "translation-handle-y-positive",
        "translation-handle-z-positive"
      ]
    );
    for (const handle of renderedHandles) {
      assert.ok(handle.getObjectByName("translation-handle-outline"));
      assert.ok(handle.getObjectByName("translation-handle-picker"));
    }

    harness.controls.dispose();
  });

  test("expands the outline past every visual boundary", () => {
    const harness = createHarness();
    const handle = handles(harness.controls)[0];
    const visual = handle.getObjectByName(
      "translation-handle-visual"
    ) as THREE.Mesh<THREE.BufferGeometry>;
    const outline = handle.getObjectByName(
      "translation-handle-outline"
    ) as THREE.Mesh<THREE.BufferGeometry>;
    visual.geometry.computeBoundingBox();
    outline.geometry.computeBoundingBox();

    const visualBounds = visual.geometry.boundingBox!;
    const outlineBounds = outline.geometry.boundingBox!;
    for (const axis of ["x", "y", "z"] as const) {
      assert.ok(
        outlineBounds.min[axis] < visualBounds.min[axis],
        `${axis} minimum was not expanded`
      );
      assert.ok(
        outlineBounds.max[axis] > visualBounds.max[axis],
        `${axis} maximum was not expanded`
      );
    }

    harness.controls.dispose();
  });

  test("supports mirrored directions and excluded axes", () => {
    const harness = createHarness({
      appearance: {
        directions: "both",
        axes: {
          y: false
        }
      }
    });

    assert.deepEqual(
      handles(harness.controls).map((handle) => handle.name),
      [
        "translation-handle-x-positive",
        "translation-handle-x-negative",
        "translation-handle-z-positive",
        "translation-handle-z-negative"
      ]
    );

    harness.controls.dispose();
  });

  test("builds spherical selectors without an outline on request", () => {
    const harness = createHarness({
      appearance: {
        handle: {
          kind: "sphere"
        },
        outline: false
      }
    });

    for (const handle of handles(harness.controls)) {
      assert.equal(
        handle.getObjectByName("translation-handle-outline"),
        undefined
      );
      const visual = handle.getObjectByName(
        "translation-handle-visual"
      ) as THREE.Mesh<THREE.BufferGeometry>;
      visual.geometry.computeBoundingSphere();
      assert.ok(visual.geometry.boundingSphere!.radius > 0);
    }

    harness.controls.dispose();
  });

  test("adds an outlined visual-only center on request", () => {
    const harness = createHarness({
      appearance: {
        center: {
          color: "#f4f1e8"
        }
      }
    });
    const center = harness.controls.helper.getObjectByName(
      "translation-center"
    );
    assert.ok(center);
    const visual = center.getObjectByName(
      "translation-center-visual"
    ) as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

    assert.equal(visual.material.transparent, true);
    assert.equal(visual.material.opacity, 1);
    assert.equal(visual.material.color.getHexString(), "f4f1e8");
    assert.ok(center.getObjectByName("translation-center-outline"));
    assert.equal(center.getObjectByName("translation-handle-picker"), undefined);
    assert.equal(
      harness.controls.isOverHandle(pointerAt({
        camera: harness.camera,
        element: harness.element,
        target: new THREE.Vector3(),
        type: "pointerdown"
      })),
      false
    );

    harness.controls.dispose();
  });

  test("omits the center by default", () => {
    const harness = createHarness();

    assert.equal(
      harness.controls.helper.getObjectByName("translation-center"),
      undefined
    );

    harness.controls.dispose();
  });

  test("keeps an axis visible when it aligns with the camera", () => {
    const harness = createHarness();
    harness.camera.position.set(10, 0, 0);
    harness.camera.lookAt(0, 0, 0);
    harness.scene.updateMatrixWorld(true);

    assert.equal(
      harness.controls.helper.getObjectByName(
        "translation-handle-x-positive"
      )!.visible,
      true
    );

    harness.controls.dispose();
  });
});

describe("picking", () => {
  test("hits an axis picker and leaves the center empty", () => {
    const harness = createHarness();

    assert.equal(
      harness.controls.isOverHandle(pointerAt({
        camera: harness.camera,
        element: harness.element,
        target: harness.pointOnHandle("x"),
        type: "pointerdown"
      })),
      true
    );
    assert.equal(
      harness.controls.isOverHandle(pointerAt({
        camera: harness.camera,
        element: harness.element,
        target: new THREE.Vector3(),
        type: "pointerdown"
      })),
      false
    );

    harness.controls.dispose();
  });
});

describe("dragging", () => {
  test("moves both ways from one positive handle with relative snapping", () => {
    const harness = createHarness({ snap: 1 });
    harness.target.position.x = 0.25;
    harness.scene.updateMatrixWorld(true);
    const start = harness.pointOnHandle("x");

    harness.send("pointerdown", start);
    harness.send(
      "pointermove",
      start.clone().add(new THREE.Vector3(-1.6, 0, 0))
    );

    assert.equal(harness.controls.dragging, true);
    assert.ok(Math.abs(harness.target.position.x - -1.75) < 1e-6);

    harness.send("pointerup", start);
    assert.equal(harness.controls.dragging, false);
    harness.controls.dispose();
  });

  test("brackets effective changes with copied event positions", () => {
    const harness = createHarness({ snap: 1 });
    const starts: THREE.Vector3[] = [];
    const changes: THREE.Vector3[] = [];
    const ends: TranslationEndEvent[] = [];
    harness.controls.addEventListener("start", (event) => {
      starts.push(event.position);
    });
    harness.controls.addEventListener("change", (event) => {
      changes.push(event.position);
    });
    harness.controls.addEventListener("end", (event) => {
      ends.push(event);
    });
    const start = harness.pointOnHandle("x");

    harness.send("pointerdown", start);
    harness.send(
      "pointermove",
      start.clone().add(new THREE.Vector3(1.6, 0, 0))
    );
    harness.send(
      "pointermove",
      start.clone().add(new THREE.Vector3(1.7, 0, 0))
    );
    harness.send("pointerup", start);

    assert.equal(starts.length, 1);
    assert.equal(changes.length, 1);
    assert.equal(ends.length, 1);
    assert.equal(ends[0].changed, true);
    starts[0].set(100, 100, 100);
    assert.deepEqual(harness.target.position.toArray(), [2, 0, 0]);

    harness.controls.dispose();
  });

  test("uses the rotated target axes in local space", () => {
    const harness = createHarness({ space: "local" });
    harness.target.rotation.z = Math.PI / 2;
    harness.scene.updateMatrixWorld(true);
    const start = harness.pointOnHandle("x");

    harness.send("pointerdown", start);
    harness.send(
      "pointermove",
      start.clone().add(new THREE.Vector3(0, 2, 0))
    );

    assert.ok(Math.abs(harness.target.position.x) < 1e-6);
    assert.ok(Math.abs(harness.target.position.y - 2) < 1e-6);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("converts world movement through a transformed parent", () => {
    const harness = createHarness();
    const parent = new THREE.Object3D();
    parent.position.set(3, 2, -4);
    parent.rotation.y = 0.4;
    parent.scale.set(2, 3, 4);
    harness.scene.add(parent);
    parent.add(harness.target);
    harness.scene.updateMatrixWorld(true);
    const before = harness.target.getWorldPosition(new THREE.Vector3());
    const start = harness.pointOnHandle("x");

    harness.send("pointerdown", start);
    harness.send(
      "pointermove",
      start.clone().add(new THREE.Vector3(2, 0, 0))
    );
    const after = harness.target.getWorldPosition(new THREE.Vector3());

    assert.ok(Math.abs(after.x - before.x - 2) < 1e-6);
    assert.ok(Math.abs(after.y - before.y) < 1e-6);
    assert.ok(Math.abs(after.z - before.z) < 1e-6);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("uses a per-axis snap and suspends it while Alt is held", () => {
    const snapped = createHarness({
      snap: {
        x: 2,
        y: 3,
        z: 4
      }
    });
    const snappedStart = snapped.pointOnHandle("x");

    snapped.send("pointerdown", snappedStart);
    snapped.send(
      "pointermove",
      snappedStart.clone().add(new THREE.Vector3(1.2, 0, 0))
    );
    assert.ok(Math.abs(snapped.target.position.x - 2) < 1e-6);
    snapped.send("pointerup", snappedStart);
    snapped.controls.dispose();

    const free = createHarness({ snap: 2 });
    const freeStart = free.pointOnHandle("x");
    free.send("pointerdown", freeStart);
    free.send(
      "pointermove",
      freeStart.clone().add(new THREE.Vector3(1.2, 0, 0)),
      { altKey: true }
    );
    assert.ok(Math.abs(free.target.position.x - 1.2) < 1e-6);
    free.send("pointerup", freeStart);
    free.controls.dispose();
  });

  test("reports an unchanged click on end", () => {
    const harness = createHarness();
    const ends: TranslationEndEvent[] = [];
    harness.controls.addEventListener("end", (event) => ends.push(event));
    const start = harness.pointOnHandle("x");

    harness.send("pointerdown", start);
    harness.send("pointerup", start);

    assert.equal(ends.length, 1);
    assert.equal(ends[0].changed, false);

    harness.controls.dispose();
  });

  test("ends a gesture when the target is reparented", () => {
    const harness = createHarness();
    let ended = 0;
    harness.controls.addEventListener("end", () => ended++);
    const start = harness.pointOnHandle("x");

    harness.send("pointerdown", start);
    const parent = new THREE.Object3D();
    harness.scene.add(parent);
    parent.add(harness.target);
    harness.send(
      "pointermove",
      start.clone().add(new THREE.Vector3(1, 0, 0))
    );

    assert.equal(harness.controls.dragging, false);
    assert.equal(ended, 1);

    harness.controls.dispose();
  });
});

describe("lifecycle", () => {
  test("disconnects input and disposes owned geometry once", () => {
    const harness = createHarness();
    const visual = handles(harness.controls)[0].getObjectByName(
      "translation-handle-visual"
    ) as THREE.Mesh<THREE.BufferGeometry>;
    let disposals = 0;
    visual.geometry.addEventListener("dispose", () => disposals++);

    harness.controls.dispose();
    harness.controls.dispose();
    harness.send("pointerdown", new THREE.Vector3());

    assert.equal(disposals, 1);
    assert.equal(harness.controls.dragging, false);
  });

  test("disconnect ends a gesture and reconnect accepts another", () => {
    const harness = createHarness();
    let ended = 0;
    harness.controls.addEventListener("end", () => ended++);
    const start = harness.pointOnHandle("x");

    harness.send("pointerdown", start);
    harness.controls.disconnect();

    assert.equal(harness.controls.dragging, false);
    assert.equal(ended, 1);

    harness.controls.connect(harness.element);
    harness.send("pointerdown", start);
    assert.equal(harness.controls.dragging, true);

    harness.controls.dispose();
  });
});

describe("rendering", () => {
  test("visible meshes join the transparent pass", () => {
    const harness = createHarness({
      appearance: {
        center: { outline: { opacity: 1 } },
        outline: { opacity: 1 }
      }
    });

    const materials: { name: string; transparent: boolean; }[] = [];
    harness.controls.helper.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      const material = object.material as THREE.Material;
      if (!material.visible) {
        return;
      }
      materials.push({ name: object.name, transparent: material.transparent });
    });

    assert.ok(
      materials.some((entry) => entry.name === "translation-handle-visual")
    );
    assert.ok(
      materials.some((entry) => entry.name === "translation-handle-outline")
    );
    assert.ok(
      materials.some((entry) => entry.name === "translation-center-visual")
    );
    assert.ok(
      materials.some((entry) => entry.name === "translation-center-outline")
    );
    assert.deepEqual(
      materials.filter((entry) => !entry.transparent),
      []
    );

    harness.controls.dispose();
  });
});
