// Import Node.js Dependencies
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import {
  after,
  before,
  describe,
  it
} from "node:test";
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import { build } from "esbuild";
import {
  chromium,
  type Browser,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import type { ParityOptions } from "./fixtures/vertexPulling.ts";

// CONSTANTS
const kTolerance = 8;
const kFullShade = 1024;
const kScenes: Omit<ParityOptions, "forceWebGL" | "expanded">[] = [
  { channel: "uv" },
  { channel: "normal" },
  { channel: "shade", ambientOcclusion: true },
  { channel: "faceShade", ambientOcclusion: true },
  { channel: "lit", ambientOcclusion: true },
  { channel: "velocity" }
];
const kForceWebGL = process.env.VOXEL_TEST_WEBGPU !== "1";

describe("vertex pulling on the GPU", { timeout: 120_000 }, () => {
  let server: Server;
  let browser: Browser | undefined;
  let page: Page;
  const errors: string[] = [];

  before(async() => {
    const bundle = await build({
      entryPoints: [fileURLToPath(new URL("./fixtures/vertexPulling.ts", import.meta.url))],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser"
    });
    server = createServer((request, response) => {
      response.setHeader("Content-Type", request.url === "/probe.js" ?
        "text/javascript" : "text/html");
      response.end(request.url === "/probe.js" ? bundle.outputFiles[0].text :
        "<!doctype html><title>Vertex pulling parity</title>");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");

    browser = await chromium.launch({
      channel: process.env.VOXEL_TEST_BROWSER ?? "chrome",
      headless: true,
      args: ["--enable-unsafe-swiftshader", "--enable-unsafe-webgpu"]
    });
    page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        errors.push(message.text());
      }
    });
    await page.goto(`http://127.0.0.1:${address.port}`);
  });

  after(async() => {
    await browser?.close();
    server.close();
    await once(server, "close");
  });

  it("draws pulled chunks like their expanded face records", async() => {
    for (const scene of kScenes) {
      const [expanded, pulled] = await page.evaluate(async(options) => {
        const modulePath = "/probe.js";
        const { renderParityScene }: typeof import("./fixtures/vertexPulling.ts") =
          await import(modulePath);

        return [
          await renderParityScene({ ...options, expanded: true }),
          await renderParityScene({ ...options, expanded: false })
        ];
      }, { ...scene, forceWebGL: kForceWebGL });

      assert.deepEqual(errors, []);
      assert.equal(pulled.length, expanded.length);
      assert.ok(new Set(expanded).size > 4, "the parity scene must not be blank");
      let worst = 0;
      for (let i = 0; i < expanded.length; i++) {
        worst = Math.max(worst, Math.abs(expanded[i] - pulled[i]));
      }
      assert.ok(worst <= kTolerance, `${JSON.stringify(scene)}: channels differ by up to ${worst}`);
    }
  });

  it("keeps the AO shade of multisampled face edges within full light", async() => {
    const pixels = await page.evaluate(async(options) => {
      const modulePath = "/probe.js";
      const { renderParityScene }: typeof import("./fixtures/vertexPulling.ts") =
        await import(modulePath);

      return renderParityScene(options);
    }, {
      forceWebGL: kForceWebGL,
      expanded: false,
      channel: "shade",
      ambientOcclusion: true,
      multisampled: true
    } satisfies ParityOptions);

    assert.deepEqual(errors, []);
    assert.ok(new Set(pixels).size > 4, "the parity scene must not be blank");
    const brightest = Math.max(...pixels);
    assert.ok(brightest <= kFullShade, `shade reaches ${brightest / kFullShade}`);
  });
});
