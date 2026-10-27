// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate as settle } from "node:timers/promises";

// Import Third-party Dependencies
import { encodeContent } from "@jolly-pixel/asset-server";
import {
  GROUND_MATERIAL,
  TerrainDocument
} from "@jolly-pixel/asset.terrain/client";
import type {
  MaterialImage,
  MaterialMap,
  MaterialSurface
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { TextureDocument } from "#src/features/materials/model/TextureDocument.ts";
import {
  MaterialTextures,
  type DecodedImage,
  type TextureLease
} from "#src/features/materials/rendering/MaterialTextures.ts";

interface LabelledImage extends DecodedImage {
  readonly label: string;
}

class RecordingView {
  events: string[] = [];
  #size = 1024;

  get materialTextureSize(): number {
    return this.#size;
  }

  set materialTextureSize(
    size: number
  ) {
    this.#size = size;
    this.events.push(`size ${size}`);
  }

  materialChanged(
    slot: number,
    surface: MaterialSurface
  ): void {
    this.events.push(`material ${slot} tiling ${surface.tiling}`);
  }

  materialRemoved(
    slot: number
  ): void {
    this.events.push(`removed ${slot}`);
  }

  writeMaterialMap(
    slot: number,
    map: MaterialMap,
    image: MaterialImage | null
  ): void {
    const label = image === null ? "none" : `${(image as LabelledImage).label}@${image.width}`;
    this.events.push(`${map} ${slot} ${label}`);
  }

  writes(): string[] {
    return this.events.filter((event) => /^(albedo|normal|orm|height) /.test(event));
  }
}

function texture(
  id: string
) {
  return { id, kind: "texture" };
}

function materialsSetup(
  contents: Record<string, string> = {}
) {
  const document = new TerrainDocument();
  document.load({ chunks: [{ x: 0, z: 0 }] });
  const view = new RecordingView();
  const textures = new Map<string, TextureDocument>();
  const opened: string[] = [];
  const released: string[] = [];
  const failed: string[] = [];
  let decodeGate: Promise<void> = Promise.resolve();

  function lease(
    assetId: string
  ): TextureLease {
    opened.push(assetId);
    const textureDocument = new TextureDocument();
    textureDocument.load(encodeContent(new TextEncoder().encode(contents[assetId] ?? assetId)));
    textures.set(assetId, textureDocument);

    return {
      document: textureDocument,
      ready: Promise.resolve(),
      release: () => released.push(assetId)
    };
  }

  async function decode(
    bytes: Uint8Array,
    size: number
  ): Promise<LabelledImage> {
    await decodeGate;
    const label = new TextDecoder().decode(bytes);
    if (label === "broken") {
      throw new Error("unsupported format");
    }

    return { label, width: size, height: size, close: () => undefined };
  }

  const materials = new MaterialTextures({
    document,
    view,
    lease,
    decode,
    failed: (assetId) => failed.push(assetId)
  });

  return {
    document,
    view,
    materials,
    textures,
    opened,
    released,
    failed,
    holdDecodes(): () => void {
      const { promise, resolve } = Promise.withResolvers<void>();
      decodeGate = promise;

      return resolve;
    }
  };
}

describe("MaterialTextures", () => {
  test("a material's maps reach the view decoded at the terrain's texture size", async() => {
    const { document, view } = materialsSetup({ grass: "grass" });
    document.updateMaterial(GROUND_MATERIAL.id, { albedo: texture("grass"), tiling: 8 });
    await settle();

    assert.deepEqual(view.events, [
      "material 0 tiling 4",
      "material 0 tiling 8",
      "albedo 0 grass@1024"
    ]);
  });

  test("maps sharing a texture lease it once, and release it once no material uses it", async() => {
    const { document, opened, released } = materialsSetup();
    document.updateMaterial(GROUND_MATERIAL.id, { albedo: texture("rock"), height: texture("rock") });
    const sand = document.addMaterial({ albedo: texture("rock") })!;
    await settle();
    document.updateMaterial(GROUND_MATERIAL.id, { albedo: null, height: null });
    assert.deepEqual(released, []);
    document.removeMaterial(sand);

    assert.deepEqual(opened, ["rock"]);
    assert.deepEqual(released, ["rock"]);
  });

  test("a texture size change redraws every map at the new size", async() => {
    const { document, view } = materialsSetup();
    document.updateMaterial(GROUND_MATERIAL.id, { albedo: texture("grass") });
    await settle();
    view.events.length = 0;

    document.changeTextureSize(512);
    await settle();

    assert.deepEqual(view.events.filter((event) => event.startsWith("size")), ["size 512"]);
    assert.deepEqual(
      view.writes().sort(),
      ["albedo 0 grass@512", "height 0 none", "normal 0 none", "orm 0 none"]
    );
  });

  test("new content in a texture redraws the maps that use it", async() => {
    const { document, view, textures } = materialsSetup();
    document.updateMaterial(GROUND_MATERIAL.id, { albedo: texture("grass"), normal: texture("grass") });
    await settle();
    view.events.length = 0;

    textures.get("grass")!.load(encodeContent(new TextEncoder().encode("grass-v2")));
    await settle();

    assert.deepEqual(view.writes().sort(), ["albedo 0 grass-v2@1024", "normal 0 grass-v2@1024"]);
  });

  test("a decode that ends after its material was removed or reassigned never reaches the view", async() => {
    const { document, view, holdDecodes } = materialsSetup();
    const open = holdDecodes();
    document.updateMaterial(GROUND_MATERIAL.id, { albedo: texture("grass") });
    document.updateMaterial(GROUND_MATERIAL.id, { albedo: texture("sand") });
    const rock = document.addMaterial({ albedo: texture("rock") })!;
    document.removeMaterial(rock);
    open();
    await settle();

    assert.deepEqual(view.writes(), ["albedo 0 sand@1024"]);
    assert.ok(view.events.includes("removed 1"));
  });

  test("a texture that cannot be decoded falls back and is reported", async() => {
    const { document, view, failed } = materialsSetup({ bad: "broken" });
    document.updateMaterial(GROUND_MATERIAL.id, { albedo: texture("bad") });
    await settle();

    assert.deepEqual(view.writes(), ["albedo 0 none"]);
    assert.deepEqual(failed, ["bad"]);
  });
});
