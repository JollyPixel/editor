// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { randomColor } from "./_fixtures.ts";
import { IslandMap } from "../src/normal/IslandMap.ts";
import { NormalMapConfig } from "../src/normal/NormalMapConfig.ts";
import { NormalMapGenerator } from "../src/normal/NormalMapGenerator.ts";
import type {
  IslandFace,
  NormalMapHeight,
  NormalMapInput
} from "../src/normal/types.ts";

// CONSTANTS
const kSides = [64, 512, 2048] as const;
const kHeights: readonly NormalMapHeight[] = ["luminance", "regions", "flat"];
const kTile = 16;
const kPaletteSize = 16;

const suite = defineSuite("Normal map (normal/NormalMapGenerator)", (bench) => {
  const generator = new NormalMapGenerator();

  for (const side of kSides) {
    const pixels = atlasPixels(side);
    const islands = IslandMap.fromFaces(
      { x: side, y: side },
      tileFaces(side)
    );
    const output = new Uint8ClampedArray(side * side * 4);

    for (const height of kHeights) {
      const input: NormalMapInput = {
        size: { x: side, y: side },
        pixels,
        islands,
        config: NormalMapConfig.create({ height })
      };
      bench.add(`generate ${side}x${side} / ${height}`, () => {
        for (const island of islands.islands) {
          generator.writeIsland(input, output, island);
        }
      });
    }

    const stroke: NormalMapInput = {
      size: { x: side, y: side },
      pixels,
      islands,
      config: NormalMapConfig.create()
    };
    const area = { x: 7, y: 7, width: 3, height: 3 };
    bench.add(`stroke update ${side}x${side} / luminance`, () => {
      for (const island of islands.islandsWithin(area)) {
        generator.writeIsland(stroke, output, island, area);
      }
    });
  }

  bench.add("IslandMap.fromFaces 2048x2048 / 16px tiles", () => {
    IslandMap.fromFaces({ x: 2048, y: 2048 }, tileFaces(2048));
  });
});

export default suite;

function atlasPixels(
  side: number
): Uint8ClampedArray {
  const rng = mulberry32();
  const palette = Array.from({ length: kPaletteSize }, () => randomColor(rng));
  const pixels = new Uint8ClampedArray(side * side * 4);
  for (let index = 0; index < side * side; index++) {
    const color = palette[Math.floor(rng() * kPaletteSize)];
    pixels.set([color.r, color.g, color.b, color.a], index * 4);
  }

  return pixels;
}

function tileFaces(
  side: number
): IslandFace[] {
  const faces: IslandFace[] = [];
  for (let y = 0; y < side; y += kTile) {
    for (let x = 0; x < side; x += kTile) {
      faces.push({
        regionId: `${x}:${y}`,
        geometry: { x, y, width: kTile, height: kTile }
      });
    }
  }

  return faces;
}

if (import.meta.main) {
  await runSuites([suite]);
}
