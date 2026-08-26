// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  UVMap,
  type UVRegion,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { RegionPreview } from "../../examples/scripts/preview/RegionPreviewBehavior.ts";
import type { RegionPreviewFactoryContract } from "../../examples/scripts/preview/RegionPreviewFactory.ts";
import { RegionPreviewGallery } from "../../examples/scripts/preview/RegionPreviewGallery.ts";

class FakePreview implements RegionPreview {
  readonly mesh = new THREE.Mesh();
  readonly rotation = new THREE.Euler();
  readonly targetPositions: THREE.Vector3[] = [];
  readonly followed: UVMap[] = [];
  readonly textureSizes: Vec2[] = [];
  selected = false;

  follow(
    uv: UVMap
  ): void {
    this.followed.push(uv);
  }

  setTextureSize(
    size: Vec2
  ): void {
    this.textureSizes.push(size);
  }

  setTargetPosition(
    position: THREE.Vector3
  ): void {
    this.targetPositions.push(position.clone());
  }

  setSelected(
    selected: boolean
  ): void {
    this.selected = selected;
  }

  setBorderColor(
    _color: THREE.ColorRepresentation
  ): void {
    // No-op test double.
  }

  setRotating(
    _rotating: boolean
  ): void {
    // No-op test double.
  }

  setRotation(
    rotation: THREE.Euler
  ): void {
    this.rotation.copy(rotation);
  }
}

class FakePreviewFactory implements RegionPreviewFactoryContract {
  readonly previews: FakePreview[] = [];
  readonly destroyed: RegionPreview[] = [];

  create(
    _region: UVRegion,
    _textureSize: Vec2
  ): FakePreview {
    const preview = new FakePreview();
    this.previews.push(preview);

    return preview;
  }

  destroy(
    preview: RegionPreview
  ): void {
    this.destroyed.push(preview);
  }
}

function createUv(): UVMap {
  return new UVMap({
    getCanvasSize: () => {
      return { x: 64, y: 64 };
    }
  });
}

describe("RegionPreviewGallery", () => {
  test("mirrors region lifecycle and selection", () => {
    const uv = createUv();
    const factory = new FakePreviewFactory();
    const gallery = new RegionPreviewGallery({
      previewFactory: factory,
      canvasManager: {
        uv,
        textureSize: { x: 64, y: 64 }
      }
    });

    uv.create({ id: "first", width: 16, height: 16 });
    uv.create({ id: "second", width: 16, height: 16 });
    assert.strictEqual(factory.previews.length, 2);
    assert.strictEqual(gallery.meshes.length, 2);

    uv.select("second");
    assert.strictEqual(factory.previews[0].selected, false);
    assert.strictEqual(factory.previews[1].selected, true);

    uv.delete("first");
    assert.deepStrictEqual(factory.destroyed, [factory.previews[0]]);
    assert.strictEqual(gallery.meshes.length, 1);
  });

  test("hands region tracking to each preview", () => {
    const uv = createUv();
    const factory = new FakePreviewFactory();
    new RegionPreviewGallery({
      previewFactory: factory,
      canvasManager: {
        uv,
        textureSize: { x: 64, y: 64 }
      }
    });

    uv.create({ id: "first", width: 16, height: 16 });

    assert.deepStrictEqual(factory.previews[0].followed, [uv]);
  });

  test("refreshTextureSize pushes the current size to every preview", () => {
    const uv = createUv();
    const factory = new FakePreviewFactory();
    const gallery = new RegionPreviewGallery({
      previewFactory: factory,
      canvasManager: {
        uv,
        textureSize: { x: 32, y: 16 }
      }
    });

    uv.create({ id: "first", width: 16, height: 16 });
    gallery.refreshTextureSize();

    assert.deepStrictEqual(
      factory.previews[0].textureSizes,
      [{ x: 32, y: 16 }]
    );
  });

  test("disposes previews and detaches listeners once", () => {
    const uv = createUv();
    const factory = new FakePreviewFactory();
    const gallery = new RegionPreviewGallery({
      previewFactory: factory,
      canvasManager: {
        uv,
        textureSize: { x: 64, y: 64 }
      }
    });

    uv.create({ id: "before-dispose", width: 16, height: 16 });
    gallery.dispose();
    gallery.dispose();
    uv.create({ id: "after-dispose", width: 16, height: 16 });

    assert.strictEqual(factory.previews.length, 1);
    assert.deepStrictEqual(factory.destroyed, [factory.previews[0]]);
    assert.deepStrictEqual(gallery.meshes, []);
  });
});
