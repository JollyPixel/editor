// Import Node.js Dependencies
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import { build } from "esbuild";
import { chromium } from "@playwright/test";

// Import Internal Dependencies
import type { ParityOptions } from "./fixtures/vertexPulling.ts";

// CONSTANTS
const kTolerance = 8;
const kScenes: Omit<ParityOptions, "forceWebGL" | "expanded">[] = [
  { channel: "uv" },
  { channel: "normal" },
  { channel: "shade", ambientOcclusion: true },
  { channel: "lit", ambientOcclusion: true },
  { channel: "velocity" }
];

it("draws pulled chunks like their expanded face records on the GPU", {
  timeout: 120_000
}, async() => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("./fixtures/vertexPulling.ts", import.meta.url))],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser"
  });
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", request.url === "/probe.js" ?
      "text/javascript" : "text/html");
    response.end(request.url === "/probe.js" ? bundle.outputFiles[0].text :
      "<!doctype html><title>Vertex pulling parity</title>");
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
    const forceWebGL = process.env.VOXEL_TEST_WEBGPU !== "1";
    for (const scene of kScenes) {
      const [expanded, pulled] = await page.evaluate(async(options) => {
        const modulePath = "/probe.js";
        const { renderParityScene }: typeof import("./fixtures/vertexPulling.ts") =
          await import(modulePath);

        return [
          await renderParityScene({ ...options, expanded: true }),
          await renderParityScene({ ...options, expanded: false })
        ];
      }, { ...scene, forceWebGL });

      assert.deepEqual(errors, []);
      assert.equal(pulled.length, expanded.length);
      assert.ok(new Set(expanded).size > 4, "the parity scene must not be blank");
      let worst = 0;
      for (let i = 0; i < expanded.length; i++) {
        worst = Math.max(worst, Math.abs(expanded[i] - pulled[i]));
      }
      assert.ok(worst <= kTolerance, `${JSON.stringify(scene)}: channels differ by up to ${worst}`);
    }
  }
  finally {
    await browser?.close();
    server.close();
    await once(server, "close");
  }
});
