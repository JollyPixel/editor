// Import Node.js Dependencies
import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";

// Import Third-party Dependencies
import { chromium } from "@playwright/test";
import type { Texture } from "three/webgpu";

// CONSTANTS
const kCubeSize = 64;
const kMipLevels = 4;
const kOrigin = "https://bake.local";
const kPackageRoot = path.join(import.meta.dirname, "..");
const kThreeRoot = path.join(kPackageRoot, "node_modules/three");
const kOutput = path.join(
  kPackageRoot,
  "src/three/rendering/environment/roomEnvironment.bin"
);
const kContentTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".ts": "text/javascript"
};
const kPage = `<!doctype html>
<script type="importmap">
{
  "imports": {
    "three": "/three/build/three.webgpu.js",
    "three/webgpu": "/three/build/three.webgpu.js",
    "three/tsl": "/three/build/three.tsl.js",
    "three/addons/": "/three/examples/jsm/",
    "#src/": "/src/"
  }
}
</script>
<body></body>`;

interface BakeLayout {
  size: number;
  levels: number;
}

interface BakeResult {
  backend: string;
  texels: number[];
  difference: number;
}

const browser = await chromium.launch({ headless: false });
try {
  const page = await browser.newPage();
  await page.route(`${kOrigin}/**`, async(route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      await route.fulfill({
        contentType: kContentTypes[".html"],
        body: kPage
      });

      return;
    }

    if (pathname.startsWith("/src/")) {
      const source = await fs.readFile(
        path.join(kPackageRoot, pathname),
        "utf8"
      );
      await route.fulfill({
        contentType: kContentTypes[".ts"],
        body: stripTypeScriptTypes(source)
      });

      return;
    }

    const file = path.join(kThreeRoot, pathname.replace(/^\/three\//, ""));
    await route.fulfill({
      contentType: kContentTypes[path.extname(file)] ?? "text/plain",
      body: await fs.readFile(file)
    });
  });
  await page.goto(`${kOrigin}/`);

  const result = await page.evaluate(bakeInPage, {
    size: kCubeSize,
    levels: kMipLevels
  });
  if (result.backend !== "WebGPU") {
    throw new Error(`Baking needs WebGPU, the page ran on ${result.backend}`);
  }
  if (result.difference !== 0) {
    throw new Error(
      `The uploaded map renders ${result.difference} away from the generated one`
    );
  }

  await fs.writeFile(kOutput, Uint16Array.from(result.texels));
  console.log(`wrote ${kOutput}`);
}
finally {
  await browser.close();
}

async function bakeInPage(
  layout: BakeLayout
): Promise<BakeResult> {
  const THREE = await import("three/webgpu");
  const { RoomEnvironment } = await import(
    "three/addons/environments/RoomEnvironment.js"
  );
  const { BakedRoomEnvironment } = await import(
    "#src/three/rendering/environment/BakedRoomEnvironment.ts"
  );

  const renderer = new THREE.WebGPURenderer();
  await renderer.init();

  const generated = new THREE.CubeRenderTarget(layout.size, {
    minFilter: THREE.LinearMipmapLinearFilter,
    generateMipmaps: false,
    type: THREE.HalfFloatType,
    colorSpace: THREE.LinearSRGBColorSpace,
    depthBuffer: false
  });
  for (let level = 0; level < layout.levels; level++) {
    const faceSize = layout.size >> level;
    // @ts-expect-error
    generated.texture.mipmaps.push({
      width: faceSize,
      height: faceSize
    });
  }
  generated.texture.isPMREMTexture = true;

  const generator = new THREE.PMREMGenerator(renderer);
  generator.fromScene(
    new RoomEnvironment(),
    0.04,
    0.1,
    100,
    { renderTarget: generated }
  );

  const texels: number[] = [];
  for (let level = 0; level < layout.levels; level++) {
    const faceSize = layout.size >> level;
    const face = new THREE.RenderTarget(faceSize, faceSize, {
      type: THREE.HalfFloatType,
      depthBuffer: false
    });
    renderer.initRenderTarget(face);
    for (let layer = 0; layer < 6; layer++) {
      renderer.copyTextureToTexture(
        generated.texture,
        face.texture,
        new THREE.Box3(
          new THREE.Vector3(0, 0, layer),
          new THREE.Vector3(faceSize, faceSize, layer + 1)
        ),
        new THREE.Vector3(0, 0, 0),
        level,
        0
      );
      const pixels = await renderer.readRenderTargetPixelsAsync(
        face,
        0,
        0,
        faceSize,
        faceSize
      ) as Uint16Array;
      for (const value of pixels) {
        texels.push(value);
      }
    }
    face.dispose();
  }

  const restored = new BakedRoomEnvironment(Uint16Array.from(texels))
    .createRenderTarget(renderer);

  const viewSize = 256;
  const view = new THREE.RenderTarget(viewSize, viewSize, {
    type: THREE.HalfFloatType
  });
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
  camera.position.set(1.2, 1.4, 2.6);
  camera.lookAt(0, 0, 0);

  async function render(
    environment: Texture,
    roughness: number
  ): Promise<Uint16Array> {
    const scene = new THREE.Scene();
    scene.environment = environment;
    scene.add(new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.5, 0.18, 192, 32),
      new THREE.MeshStandardMaterial({
        metalness: 1,
        roughness
      })
    ));
    renderer.setRenderTarget(view);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    return await renderer.readRenderTargetPixelsAsync(
      view,
      0,
      0,
      viewSize,
      viewSize
    ) as Uint16Array;
  }

  let difference = 0;
  for (const roughness of [0, 0.3, 0.7]) {
    const expected = await render(generated.texture, roughness);
    const actual = await render(restored.texture, roughness);
    for (let index = 0; index < expected.length; index++) {
      difference = Math.max(
        difference,
        Math.abs(
          THREE.DataUtils.fromHalfFloat(expected[index]) -
          THREE.DataUtils.fromHalfFloat(actual[index])
        )
      );
    }
  }

  return {
    backend: "isWebGPUBackend" in renderer.backend ? "WebGPU" : "WebGL2",
    texels,
    difference
  };
}
