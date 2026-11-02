// Import Third-party Dependencies
import { Font } from "three/examples/jsm/loaders/FontLoader.js";

export function blockFont(): Font {
  return new Font({
    glyphs: {
      A: {
        ha: 700,
        x_min: 0,
        x_max: 600,
        o: "m 0 0 l 0 700 l 600 700 l 600 0 z"
      }
    },
    familyName: "Block",
    ascender: 800,
    descender: -200,
    underlinePosition: -100,
    underlineThickness: 50,
    boundingBox: {
      xMin: 0,
      xMax: 600,
      yMin: -200,
      yMax: 800
    },
    resolution: 1000,
    original_font_information: {}
  });
}
