// Import Node.js Dependencies
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import { build } from "esbuild";
import {
  chromium,
  type Browser,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import type {
  ProbeOptions,
  ProbeResult
} from "./fixtures/postProcessing.ts";

// CONSTANTS
const kForceWebGL = process.env.ENGINE_TEST_WEBGPU !== "1";

function isRed(
  pixel: number[]
): boolean {
  return pixel[0] > 150 && pixel[1] < 60 && pixel[2] < 60;
}

function isCleared(
  pixel: number[]
): boolean {
  return pixel[0] < 30 && pixel[1] < 30 && pixel[2] < 30;
}

describe("camera post-processing on the GPU", { timeout: 120_000 }, () => {
  let browser: Browser | undefined;
  let page: Page;
  const errors: string[] = [];
  const server = createServer();

  before(async() => {
    const bundle = await build({
      entryPoints: [fileURLToPath(new URL("./fixtures/postProcessing.ts", import.meta.url))],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser"
    });
    server.on("request", (request, response) => {
      response.setHeader("Content-Type", request.url === "/probe.js" ?
        "text/javascript" : "text/html");
      response.end(request.url === "/probe.js" ? bundle.outputFiles[0].text :
        "<!doctype html><title>Post-processing regression</title>");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");

    browser = await chromium.launch({
      channel: process.env.ENGINE_TEST_BROWSER ?? "chrome",
      headless: true,
      args: ["--enable-unsafe-swiftshader", "--enable-unsafe-webgpu"]
    });
    page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
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

  function probe(
    options: Omit<ProbeOptions, "forceWebGL">
  ): Promise<ProbeResult> {
    return page.evaluate(async(probeOptions) => {
      const modulePath = "/probe.js";
      const fixture: typeof import("./fixtures/postProcessing.ts") =
        await import(modulePath);

      return fixture.probe(probeOptions);
    }, { ...options, forceWebGL: kForceWebGL });
  }

  it("should draw the pipeline output on the canvas", async() => {
    const { left, right } = await probe({});

    assert.ok(isRed(left), `left: ${left}`);
    assert.ok(isRed(right), `right: ${right}`);
    assert.deepEqual(errors, []);
  });

  it("should keep the pipeline output under a later tone-mapped render", async() => {
    const { left, right } = await probe({ overlay: true });

    assert.ok(isRed(left), `left: ${left}`);
    assert.ok(isRed(right), `right: ${right}`);
    assert.deepEqual(errors, []);
  });

  it("should draw the pipeline output inside the camera viewport", async() => {
    const { left, right } = await probe({
      overlay: true,
      viewport: { x: 0, y: 0, width: 0.5, height: 1 }
    });

    assert.ok(isRed(left), `left: ${left}`);
    assert.ok(isCleared(right), `right: ${right}`);
    assert.deepEqual(errors, []);
  });
});
