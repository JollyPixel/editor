// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { disposeObject3D } from "../../src/utils/disposeObject3D.ts";

function countDisposals(
  target: THREE.EventDispatcher
): () => number {
  let disposals = 0;
  target.addEventListener("dispose", () => disposals++);

  return () => disposals;
}

describe("disposeObject3D", () => {
  test("disposes a shared geometry and material once across a subtree", () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(geometry, material),
      new THREE.Mesh(geometry, material)
    );

    const geometryDisposals = countDisposals(geometry);
    const materialDisposals = countDisposals(material);

    disposeObject3D(group);

    assert.equal(geometryDisposals(), 1);
    assert.equal(materialDisposals(), 1);
  });

  test("disposes the root node itself", () => {
    const geometry = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const geometryDisposals = countDisposals(geometry);

    disposeObject3D(mesh);

    assert.equal(geometryDisposals(), 1);
  });

  test("disposes every material of a multi-material mesh", () => {
    const materials = [
      new THREE.MeshBasicMaterial(),
      new THREE.MeshBasicMaterial()
    ];
    const disposals = materials.map(countDisposals);

    disposeObject3D(new THREE.Mesh(new THREE.BoxGeometry(), materials));

    assert.deepEqual(disposals.map((count) => count()), [1, 1]);
  });

  test("keeps textures alive by default", () => {
    const texture = new THREE.Texture();
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const textureDisposals = countDisposals(texture);

    disposeObject3D(new THREE.Mesh(new THREE.BoxGeometry(), material));

    assert.equal(textureDisposals(), 0);
  });

  test("disposes textures once when asked to", () => {
    const texture = new THREE.Texture();
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshBasicMaterial({ map: texture })
      ),
      new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshBasicMaterial({ map: texture })
      )
    );
    const textureDisposals = countDisposals(texture);

    disposeObject3D(group, { textures: true });

    assert.equal(textureDisposals(), 1);
  });

  test("disposes textures held by shader material uniforms", () => {
    const texture = new THREE.Texture();
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uIntensity: { value: 1 }
      }
    });
    const textureDisposals = countDisposals(texture);

    disposeObject3D(
      new THREE.Mesh(new THREE.BoxGeometry(), material),
      { textures: true }
    );

    assert.equal(textureDisposals(), 1);
  });

  test("closes an ImageBitmap source when disposing its texture", () => {
    let closed = 0;
    class FakeImageBitmap {
      close() {
        closed++;
      }
    }
    const previous = globalThis.ImageBitmap;
    globalThis.ImageBitmap = FakeImageBitmap as any;

    try {
      const texture = new THREE.Texture(new FakeImageBitmap() as any);
      const material = new THREE.MeshBasicMaterial({ map: texture });

      disposeObject3D(
        new THREE.Mesh(new THREE.BoxGeometry(), material),
        { textures: true }
      );
    }
    finally {
      globalThis.ImageBitmap = previous;
    }

    assert.equal(closed, 1);
  });

  test("disposes a skeleton shared by several skinned meshes once", () => {
    const skeleton = new THREE.Skeleton([new THREE.Bone()]);
    const group = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const mesh = new THREE.SkinnedMesh(
        new THREE.BoxGeometry(),
        new THREE.MeshBasicMaterial()
      );
      mesh.skeleton = skeleton;
      group.add(mesh);
    }

    let disposals = 0;
    skeleton.dispose = () => {
      disposals++;
    };

    disposeObject3D(group);

    assert.equal(disposals, 1);
  });

  test("disposes nodes exposing their own dispose method", () => {
    let disposals = 0;
    const object = new THREE.Object3D() as THREE.Object3D & { dispose(): void; };
    object.dispose = () => {
      disposals++;
    };

    disposeObject3D(object);

    assert.equal(disposals, 1);
  });

  test("detaches the root from its parent and clears its children", () => {
    const parent = new THREE.Group();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry()));
    parent.add(root);

    disposeObject3D(root);

    assert.equal(parent.children.length, 0);
    assert.equal(root.children.length, 0);
  });

  test("keeps the root attached when detach is disabled", () => {
    const parent = new THREE.Group();
    const root = new THREE.Group();
    parent.add(root);

    disposeObject3D(root, { detach: false });

    assert.deepEqual(parent.children, [root]);
  });

  test("stops the traversal on nested actors when asked to", () => {
    const nestedGeometry = new THREE.BoxGeometry();
    const nested = new THREE.Group();
    nested.userData.isActor = true;
    nested.add(new THREE.Mesh(nestedGeometry, new THREE.MeshBasicMaterial()));

    const ownGeometry = new THREE.BoxGeometry();
    const root = new THREE.Group();
    root.userData.isActor = true;
    root.add(new THREE.Mesh(ownGeometry, new THREE.MeshBasicMaterial()), nested);

    const nestedDisposals = countDisposals(nestedGeometry);
    const ownDisposals = countDisposals(ownGeometry);

    disposeObject3D(root, { stopAtActors: true });

    assert.equal(ownDisposals(), 1);
    assert.equal(nestedDisposals(), 0);
  });
});
