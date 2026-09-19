// Import Third-party Dependencies
import "@jolly-pixel/ui";

// Import Internal Dependencies
import { isTextureImportPolicy } from "../../src/textures/textures.ts";
import "../../src/index.ts";
import { PixelArtDemo } from "./boot/PixelArtDemo.ts";
import { DEMO_ASSET_PATH } from "./config.ts";

declare global {
  interface Window {
    pixelArtDemo?: PixelArtDemo;
  }
}

const query = new URLSearchParams(location.search);
const importPolicy = query.get("import-policy");

const demo = await PixelArtDemo.open({
  asset: query.get("asset") ?? DEMO_ASSET_PATH,
  preview: query.get("runtime") !== "off",
  starterRegion: !query.has("empty"),
  importPolicy: importPolicy !== null && isTextureImportPolicy(importPolicy) ?
    importPolicy :
    undefined,
  maxFps: positiveNumber(query.get("max-fps")),
  addDelay: positiveNumber(query.get("add-delay"))
});
window.addEventListener("beforeunload", () => demo.dispose(), {
  once: true
});

if (import.meta.env.DEV) {
  window.pixelArtDemo = demo;
}

function positiveNumber(
  value: string | null
): number | undefined {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
