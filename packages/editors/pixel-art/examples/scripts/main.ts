// Import Third-party Dependencies
import "@jolly-pixel/ui";
import { mountStandalone } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import "../../src/index.ts";
import { PixelArtDemo } from "./boot/PixelArtDemo.ts";

declare global {
  interface Window {
    pixelArtDemo?: PixelArtDemo;
  }
}

const demo = await mountStandalone(PixelArtDemo, {
  debugHandle: import.meta.env.DEV ? "pixelArtDemo" : undefined
});
window.addEventListener("beforeunload", () => demo.dispose(), {
  once: true
});
