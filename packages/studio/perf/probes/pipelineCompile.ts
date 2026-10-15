// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import { chromium } from "@playwright/test";

// Import Internal Dependencies
import { STUDIO_URL } from "../editors.ts";

// CONSTANTS
const kBlankUrl = new URL("main.css", STUDIO_URL).href;

type CompileMode = "sync" | "async";

const { values: args } = parseArgs({
  options: {
    pipelines: { type: "string", default: "24" },
    rounds: { type: "string", default: "6" }
  }
});

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto(kBlankUrl);
await compile("async", 1_000);

for (let round = 0; round < Number(args.rounds); round++) {
  const modes: CompileMode[] = round % 2 === 0 ? ["sync", "async"] : ["async", "sync"];
  for (const mode of modes) {
    console.log(mode.padEnd(5), await compile(mode, round * 10 + modes.indexOf(mode)));
  }
}
await browser.close();

function compile(
  mode: CompileMode,
  seed: number
): Promise<string> {
  return page.evaluate(async({ mode, seed, count }): Promise<string> => {
    const gpu = Reflect.get(navigator, "gpu") as {
      requestAdapter(): Promise<{ requestDevice(): Promise<any>; }>;
    };
    const device = await (await gpu.requestAdapter()).requestDevice();
    function shader(
      index: number
    ): string {
      return `
      struct V { @builtin(position) p: vec4f, @location(0) uv: vec2f };
      @vertex fn vs(@builtin(vertex_index) i: u32) -> V {
        var o: V; let x = f32(i & 1u); let y = f32(i >> 1u);
        o.p = vec4f(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0); o.uv = vec2f(x, y); return o;
      }
      @fragment fn fs(v: V) -> @location(0) vec4f {
        var c = vec3f(${seed}.0 + ${index}.0);
        for (var k = 0; k < 48; k++) {
          let f = f32(k) * 0.37 + ${index}.0;
          c += vec3f(sin(v.uv.x * f + c.y), cos(v.uv.y * f - c.z), sin((v.uv.x + v.uv.y) * f * c.x));
          c = fract(c * 1.7 + vec3f(0.11, 0.23, 0.31));
        }
        return vec4f(c, 1.0);
      }`;
    }
    const descriptors = Array.from({ length: count }, (_, index) => {
      const module = device.createShaderModule({ code: shader(index) });

      return {
        layout: "auto",
        vertex: {
          module,
          entryPoint: "vs"
        },
        fragment: {
          module,
          entryPoint: "fs",
          targets: [{ format: "rgba8unorm" }]
        },
        primitive: { topology: "triangle-strip" }
      };
    });

    const start = performance.now();
    if (mode === "sync") {
      for (const descriptor of descriptors) {
        device.createRenderPipeline(descriptor);
      }
    }
    else {
      await Promise.all(descriptors.map((descriptor) => device.createRenderPipelineAsync(descriptor)));
    }
    await device.queue.onSubmittedWorkDone();
    const elapsed = performance.now() - start;
    device.destroy();

    return `${count} pipelines ready in ${Math.round(elapsed)} ms`;
  }, {
    mode,
    seed,
    count: Number(args.pipelines)
  });
}
