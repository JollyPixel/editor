// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  imageDataToPixels,
  pixelsToImageData
} from "../src/pixels.ts";
import { imageBytes } from "./_fixtures.ts";

// CONSTANTS
const kSizes = [64, 256, 1024];

const suite = defineSuite("pixels", (bench) => {
  for (const size of kSizes) {
    const source = imageBytes(size);
    const pixels = imageDataToPixels(source);
    const mask = pixels.map((_, index) => index % 3 !== 0);
    const target = new Uint8ClampedArray(source.length);

    bench
      .add(`imageDataToPixels ${size}x${size}`, () => {
        imageDataToPixels(source);
      })
      .add(`pixelsToImageData ${size}x${size}`, () => {
        pixelsToImageData(pixels, target);
      })
      .add(`pixelsToImageData masked ${size}x${size}`, () => {
        pixelsToImageData(pixels, target, mask);
      });
  }
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
