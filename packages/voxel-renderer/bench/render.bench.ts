// Import Node.js Dependencies
import { createServer } from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import { build } from "esbuild";
import { chromium } from "@playwright/test";

// Import Internal Dependencies
import type { RenderBenchOptions } from "./fixtures/renderScene.ts";

/**
 * Frame time of a lit voxel map in headless Chrome, through the transparency
 * pass and optionally the glow (emissive MRT + bloom) pass.
 *
 * Usage: node bench/render.bench.ts [--size 96] [--lights 120] [--frames 60] [--resolution 512] [--runs 3] [--webgpu] [--gpu]
 */
const { values } = parseArgs({
  options: {
    size: { type: "string", default: "96" },
    lights: { type: "string", default: "120" },
    frames: { type: "string", default: "60" },
    resolution: { type: "string", default: "512" },
    runs: { type: "string", default: "3" },
    webgpu: { type: "boolean", default: false },
    gpu: { type: "boolean", default: false }
  }
});

interface Scenario {
  name: string;
  options: Pick<RenderBenchOptions, "glow" | "glass" | "blockLight">;
}

const kScenarios: Scenario[] = [
  { name: "plain", options: { glow: false, glass: false, blockLight: 1 } },
  { name: "plain, block light off", options: { glow: false, glass: false, blockLight: 0 } },
  { name: "plain + glass", options: { glow: false, glass: true, blockLight: 1 } },
  { name: "glow", options: { glow: true, glass: false, blockLight: 1 } }
];

const bundle = await build({
  entryPoints: [fileURLToPath(new URL("./fixtures/renderScene.ts", import.meta.url))],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser"
});
const server = createServer((request, response) => {
  response.setHeader("Content-Type", request.url === "/bench.js" ?
    "text/javascript" : "text/html");
  response.end(request.url === "/bench.js" ? bundle.outputFiles[0].text :
    "<!doctype html><title>Render bench</title>");
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (address === null || typeof address === "string") {
  throw new Error("The bench server has no port.");
}

const browser = await chromium.launch({
  channel: process.env.VOXEL_TEST_BROWSER ?? "chrome",
  headless: true,
  args: [
    "--enable-unsafe-webgpu",
    ...(values.gpu ? ["--ignore-gpu-blocklist"] : ["--enable-unsafe-swiftshader"])
  ]
});
try {
  const page = await browser.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(message.text());
    }
  });
  await page.goto(`http://127.0.0.1:${address.port}`);

  for (let run = 0; run < Number(values.runs); run++) {
    const timings: string[] = [];
    for (const scenario of kScenarios) {
      const options: RenderBenchOptions = {
        ...scenario.options,
        forceWebGL: !values.webgpu,
        size: Number(values.size),
        lights: Number(values.lights),
        frames: Number(values.frames),
        resolution: Number(values.resolution)
      };
      const msPerFrame = await page.evaluate(async(benchOptions) => {
        const modulePath = "/bench.js";
        const { renderBench }: typeof import("./fixtures/renderScene.ts") =
          await import(modulePath);

        return renderBench(benchOptions);
      }, options);
      timings.push(`${scenario.name} ${msPerFrame.toFixed(2)}ms`);
    }
    console.log(`run ${run + 1}/${values.runs} | ${timings.join(" | ")}`);
  }
}
finally {
  await browser.close();
  server.close();
}
