// Import Node.js Dependencies
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import { build } from "esbuild";
import { chromium, type Page } from "@playwright/test";

// Import Internal Dependencies
import type {
  BlockLightProbe,
  BlockLightProbeOptions
} from "./fixtures/blockLight.ts";

// CONSTANTS
const kTolerance = 3;
const kProbedCells = [1, 4, 7, 8, 11];
const kShadowContrast = 20;

async function render(
  page: Page,
  options: Omit<BlockLightProbeOptions, "forceWebGL">
): Promise<BlockLightProbe> {
  return page.evaluate(async(probeOptions) => {
    const modulePath = "/probe.js";
    const { renderBlockLightScene }: typeof import("./fixtures/blockLight.ts") =
      await import(modulePath);

    return renderBlockLightScene(probeOptions);
  }, {
    ...options,
    forceWebGL: process.env.VOXEL_TEST_WEBGPU !== "1"
  });
}

function assertFadesWithDistance(
  probe: BlockLightProbe
): void {
  const levels = kProbedCells.map((cell) => probe.floor[cell]);
  assert.ok(
    levels.every((level, index) => index === 0 || level < levels[index - 1]),
    `floor must darken away from the light, across the chunk border: ${JSON.stringify(levels)}`
  );
  assert.ok(levels[0] > 150, `the cell next to the light is bright: ${levels[0]}`);
}

it("glows with the block texture and lights the floor around it on the GPU", {
  timeout: 120_000
}, async() => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("./fixtures/blockLight.ts", import.meta.url))],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser"
  });
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", request.url === "/probe.js" ?
      "text/javascript" : "text/html");
    response.end(request.url === "/probe.js" ? bundle.outputFiles[0].text :
      "<!doctype html><title>Block light</title>");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      channel: process.env.VOXEL_TEST_BROWSER ?? "chrome",
      headless: true,
      args: ["--enable-unsafe-swiftshader", "--enable-unsafe-webgpu"]
    });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        errors.push(message.text());
      }
    });
    await page.goto(`http://127.0.0.1:${address.port}`);

    const lambert = await render(page, {
      material: "lambert",
      strength: 1
    });
    assertFadesWithDistance(lambert);

    const standard = await render(page, {
      material: "standard",
      strength: 1
    });
    assertFadesWithDistance(standard);

    const metallic = await render(page, {
      material: "standard",
      strength: 1,
      floorMetalness: 0.85
    });
    assertFadesWithDistance(metallic);

    const glow = await render(page, {
      material: "lambert",
      strength: 1,
      output: "emissive"
    });
    assert.ok(
      glow.emitter[0] > 255 - kTolerance,
      `the emitter writes its glow to the emissive output: ${glow.emitter}`
    );
    assert.ok(
      kProbedCells.every((cell) => glow.floor[cell] < kTolerance),
      `received block light stays out of the emissive output: ${JSON.stringify(glow.floor)}`
    );

    const focused = await render(page, {
      material: "lambert",
      strength: 1,
      falloff: "focused"
    });
    assertFadesWithDistance(focused);
    assert.ok(
      focused.floor[1] > lambert.floor[1] && focused.floor[8] < lambert.floor[8],
      `focused is brighter near the light, darker far away: ${focused.floor}`
    );

    const shaded = await render(page, {
      material: "lambert",
      strength: 1,
      shadowFill: 0
    });
    const filled = await render(page, {
      material: "lambert",
      strength: 1,
      shadowFill: 2
    });
    const sunlit = shaded.floor[6] - lambert.floor[6];
    const shadowed = shaded.floor[2] - lambert.floor[2];
    assert.ok(
      sunlit > kShadowContrast && shadowed < kTolerance,
      `the sun lights cell 6 and the block shades cell 2: ${sunlit}, ${shadowed}`
    );
    assert.ok(
      filled.floor[2] - shaded.floor[2] > kShadowContrast,
      `block light washes out the shadow next to the light: ${filled.floor[2]} vs ${shaded.floor[2]}`
    );

    const off = await render(page, {
      material: "lambert",
      strength: 0
    });
    assert.ok(
      kProbedCells.every((cell) => off.floor[cell] < kTolerance),
      `no block light leaves the unlit floor black: ${JSON.stringify(off.floor)}`
    );
    const [red, green, blue] = off.emitter;
    assert.ok(
      red > 255 - kTolerance && green < kTolerance && blue < kTolerance,
      `a white emissive glows in the red texture colour: ${off.emitter}`
    );
    assert.deepEqual(errors, []);
  }
  finally {
    await browser?.close();
    server.close();
    await once(server, "close");
  }
});
