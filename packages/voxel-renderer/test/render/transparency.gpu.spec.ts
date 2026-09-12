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
import type { ProbeOptions } from "./fixtures/transparency.ts";

it("composites voxel alpha on the GPU", {
  skip: process.env.npm_lifecycle_event !== "test-gpu" &&
    process.env.VOXEL_GPU_TESTS !== "1",
  timeout: 120_000
}, async() => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("./fixtures/transparency.ts", import.meta.url))],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser"
  });
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", request.url === "/probe.js" ?
      "text/javascript" : "text/html");
    response.end(request.url === "/probe.js" ? bundle.outputFiles[0].text :
      "<!doctype html><title>Transparency regression</title>");
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
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    await page.goto(`http://127.0.0.1:${address.port}`);
    const cases: { name: string; options: ProbeOptions; expected: number[]; }[] = [];
    for (const greedy of [false, true]) {
      for (const reverse of [false, true]) {
        const settings = {
          greedy, reverse, forceWebGL: process.env.VOXEL_TEST_WEBGPU !== "1"
        };
        const suffix = `greedy=${greedy}, reverse=${reverse}`;
        function sample(
          name: string,
          options: ProbeOptions,
          expected: number[]
        ): void {
          cases.push({ name: `${name} (${suffix})`, options: { ...settings, ...options }, expected });
        }
        sample("front surface", { alpha: 0.5, side: "front" }, [128, 128, 128]);
        sample("resize shared depth targets", { alpha: 0.5, resize: true }, [192, 192, 192]);
        sample("recover after draw failure", { alpha: 0.5, failDraw: true }, [192, 192, 192]);
        sample("both walls", { alpha: 0.5 }, [192, 192, 192]);
        sample("low alpha", { alpha: 0.02, side: "front" }, [5, 5, 5]);
        sample("opaque ignores texture alpha", { alpha: 0.02, mode: "opaque" }, [255, 255, 255]);
        sample("mask discards uncovered texels", { alpha: 0.02, mode: "mask" }, [0, 0, 0]);
        sample("mask coverage before fading", {
          alpha: 0.5, mode: "mask", side: "front", opacity: 0.02
        }, [5, 5, 5]);
        sample("blend multiplies layer opacity", {
          alpha: 0.5, side: "front", opacity: 0.1
        }, [13, 13, 13]);
        for (const cull of [false, true]) {
          sample(`chunk boundary cull=${cull}`, {
            alpha: 0.5, startZ: 3, count: 2, cull
          }, cull ? [192, 192, 192] : [223, 223, 223]);
          sample(`separated cubes cull=${cull}`, {
            alpha: 0.5, count: 2, spacing: 2, cull
          }, [239, 239, 239]);
        }
        sample("interior behind mask hole", {
          alpha: 1, mode: "mask", hole: true
        }, [255, 255, 255]);
        sample("opaque foreground rejects glass", {
          alpha: 0.5, count: 2, occluder: true
        }, [0, 255, 0]);
      }
    }
    const samples = await page.evaluate(async(cases) => {
      // The bundle is served by this test's local HTTP server.
      const modulePath = "/probe.js";
      const { probe }: typeof import("./fixtures/transparency.ts") =
        await import(modulePath);
      const result: number[][] = [];
      for (const testCase of cases) {
        result.push(await probe(testCase.options));
      }

      return result;
    }, cases);
    assert.deepEqual(errors, []);
    for (const [sampleIndex, testCase] of cases.entries()) {
      for (const [channel, expected] of testCase.expected.entries()) {
        assert.ok(Math.abs(samples[sampleIndex][channel] - expected) <= 2,
          `${testCase.name}: expected ${testCase.expected}, received ${samples[sampleIndex]}`);
      }
    }
    const colored = await page.evaluate(async(forceWebGL) => {
      const modulePath = "/probe.js";
      const { probe }: typeof import("./fixtures/transparency.ts") = await import(modulePath);
      const result: number[][] = [];
      for (const greedy of [false, true]) {
        for (const reverse of [false, true]) {
          for (const reverseDrawOrder of [false, true]) {
            result.push(await probe({
              alpha: 0.5, count: 2, startZ: 3, colored: true,
              greedy, reverse, reverseDrawOrder, side: "front", forceWebGL
            }));
          }
        }
      }

      return result;
    }, process.env.VOXEL_TEST_WEBGPU !== "1");
    assert.deepEqual(errors, []);
    for (let sampleIndex = 0; sampleIndex < colored.length; sampleIndex += 2) {
      const pixel = colored[sampleIndex];
      assert.ok(pixel[0] > 60 && pixel[2] > 60, JSON.stringify(colored));
      assert.equal(pixel[1], 0);
      for (const channel of [0, 1, 2]) {
        assert.ok(Math.abs(pixel[channel] - colored[sampleIndex + 1][channel]) <= 1,
          `draw order changed color: ${JSON.stringify(colored)}`);
      }
    }
  }
  finally {
    await browser?.close();
    server.close();
    await once(server, "close");
  }
});
