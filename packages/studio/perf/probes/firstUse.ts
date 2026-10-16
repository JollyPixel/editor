// Import Third-party Dependencies
import type {
  Frame,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import { BenchBrowser } from "../harness/BenchBrowser.ts";
import { STUDIO_URL } from "../harness/BenchEditors.ts";

// CONSTANTS
const kBlankUrl = new URL("main.css", STUDIO_URL).href;

interface FirstUseCosts {
  adapter: number;
  device: number;
  audio: number;
  webgl: number;
  canvas2d: number;
}

const bench = await BenchBrowser.launch();
const studio = await bench.newStudioPage({
  base: STUDIO_URL,
  mode: "offline"
});
const { page } = studio;
let iframes = 0;

await page.goto(kBlankUrl);
console.log("fresh browser, first page ", await measure(page));
console.log("same page again           ", await measure(page));
console.log("new iframe in that page   ", await measure(await addIframe(page)));

await studio.open();
console.log("studio shell, new document", await measure(await addIframe(page)));
console.log("studio shell, next iframe ", await measure(await addIframe(page)));

const tab = await bench.browser.newPage();
await tab.goto(kBlankUrl);
console.log("new tab                   ", await measure(tab));
await bench.close();

async function addIframe(
  target: Page
): Promise<Frame> {
  const id = `probe-${iframes++}`;
  await target.evaluate((src) => new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.onload = resolve;
    document.body.append(iframe);
  }), `${kBlankUrl}?${id}`);
  const frame = target.frames().find((candidate) => candidate.url().endsWith(id));
  if (frame === undefined) {
    throw new Error(`Frame ${id} not found`);
  }

  return frame;
}

function measure(
  target: Page | Frame
): Promise<string> {
  return target.evaluate(async(): Promise<string> => {
    const gpu = Reflect.get(navigator, "gpu") as {
      requestAdapter(): Promise<{
        requestDevice(): Promise<{ destroy(): void; }>;
      }>;
    };
    const costs: Partial<FirstUseCosts> = {};
    let start = performance.now();
    const adapter = await gpu.requestAdapter();
    costs.adapter = performance.now() - start;
    start = performance.now();
    const device = await adapter.requestDevice();
    costs.device = performance.now() - start;
    device.destroy();

    start = performance.now();
    const audio = new AudioContext();
    costs.audio = performance.now() - start;
    await audio.close();

    start = performance.now();
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getParameter(gl.VERSION);
    costs.webgl = performance.now() - start;

    start = performance.now();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context?.putImageData(context.createImageData(1, 1), 0, 0);
    costs.canvas2d = performance.now() - start;

    return Object.entries(costs)
      .map(([name, ms]) => `${name} ${Math.round(ms)} ms`)
      .join(", ");
  });
}
