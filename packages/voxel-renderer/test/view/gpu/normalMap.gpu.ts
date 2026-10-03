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
  NormalProbe,
  NormalProbeOptions
} from "./fixtures/normalMap.ts";

// CONSTANTS
const kTolerance = 3;
const kMargin = 10;

function assertUniform(
  probe: NormalProbe,
  message: string
): void {
  const values = Object.values(probe);
  assert.ok(
    Math.max(...values) - Math.min(...values) <= kTolerance,
    `${message}: ${JSON.stringify(probe)}`
  );
}

function assertBrighter(
  probe: NormalProbe,
  order: [keyof NormalProbe, keyof NormalProbe, keyof NormalProbe]
): void {
  const [bright, middle, dark] = order;
  assert.ok(
    probe[bright] > probe[middle] + kMargin && probe[middle] > probe[dark] + kMargin,
    `expected ${order.join(" > ")}: ${JSON.stringify(probe)}`
  );
}

async function render(
  page: Page,
  options: Omit<NormalProbeOptions, "forceWebGL">
): Promise<NormalProbe> {
  return page.evaluate(async(probeOptions) => {
    const modulePath = "/probe.js";
    const { renderNormalScene }: typeof import("./fixtures/normalMap.ts") =
      await import(modulePath);

    return renderNormalScene(probeOptions);
  }, {
    ...options,
    forceWebGL: process.env.VOXEL_TEST_WEBGPU !== "1"
  });
}

it("perturbs voxel lighting with a tangent-space normal atlas on the GPU", {
  timeout: 120_000
}, async() => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("./fixtures/normalMap.ts", import.meta.url))],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser"
  });
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", request.url === "/probe.js" ?
      "text/javascript" : "text/html");
    response.end(request.url === "/probe.js" ? bundle.outputFiles[0].text :
      "<!doctype html><title>Normal map</title>");
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

    const plain = await render(page, {
      material: "lambert",
      light: [1, 0, 1],
      normal: false
    });
    assertUniform(plain, "faces without a normal atlas share one shade");

    const fromRight = await render(page, {
      material: "lambert",
      light: [1, 0, 1],
      normal: true
    });
    assert.ok(Math.abs(fromRight.flat - plain.flat) <= kTolerance);
    assertBrighter(fromRight, ["right", "flat", "left"]);

    const fromAbove = await render(page, {
      material: "lambert",
      light: [0, 1, 1],
      normal: true
    });
    assertBrighter(fromAbove, ["up", "flat", "down"]);
    assert.ok(
      Math.abs(fromRight.right - fromAbove.up) <= kTolerance &&
      Math.abs(fromRight.left - fromAbove.down) <= kTolerance,
      `tilts along u and v weigh the same in a wide atlas: ${JSON.stringify({ fromRight, fromAbove })}`
    );

    const standard = await render(page, {
      material: "standard",
      light: [1, 0, 1],
      normal: true
    });
    assertBrighter(standard, ["right", "flat", "left"]);

    const scaledOut = await render(page, {
      material: "lambert",
      light: [1, 0, 1],
      normal: true,
      normalScale: 0
    });
    assertUniform(scaledOut, "a zero normal scale keeps the geometric normal");
    assert.deepEqual(errors, []);
  }
  finally {
    await browser?.close();
    server.close();
    await once(server, "close");
  }
});
