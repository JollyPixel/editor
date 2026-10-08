// Import Internal Dependencies
import {
  TRANSPARENT,
  hash,
  shade,
  type Palette,
  type TileCanvas,
  type TilePainter
} from "./tile.ts";

// CONSTANTS
const kBladeCount = 260;
const kRockCells = 6;

interface VoronoiSeed {
  x: number;
  y: number;
}

export function grassTop(
  palette: Palette
): TilePainter {
  return (tile) => {
    tile.each((u, v) => {
      const fine = tile.smoothNoise(u, v, 8, 2) - 0.5;
      tile.set(u, v, palette.mix(2.6 + (fine * 0.7)));
    });
    for (let blade = 0; blade < kBladeCount; blade++) {
      const lit = tile.noise(blade, 4, 8) > 0.55;
      const tone = lit ?
        3.4 + (tile.noise(blade, 5, 9) * 1.2) :
        1.1 + (tile.noise(blade, 5, 9) * 0.9);
      stroke(tile, palette, blade, tone, 2 + Math.floor(tile.noise(blade, 2, 6) * 4));
    }
  };
}

export function capSide(
  cap: Palette,
  base: TilePainter
): TilePainter {
  return (tile) => {
    base(tile);
    for (let u = 0; u < tile.size; u++) {
      const depth = fringeDepth(tile, u);
      for (let v = 0; v < depth; v++) {
        const level = 3 - ((v / depth) * 1.6) + ((tile.smoothNoise(u, v, 8, 9) - 0.5) * 0.8);
        tile.set(u, v, cap.mix(v === depth - 1 ? level - 0.7 : level));
      }
      tile.set(u, depth, shade(tile.get(u, depth), 0.68));
      tile.set(u, depth + 1, shade(tile.get(u, depth + 1), 0.84));
    }
  };
}

export function granular(
  palette: Palette
): TilePainter {
  const middle = (palette.size - 1) / 2;

  return (tile) => {
    tile.each((u, v) => {
      const mottle = tile.smoothNoise(u, v, 8, 5) - 0.5;
      const detail = tile.smoothNoise(u, v, 4, 6) - 0.5;
      const grain = tile.noise(u, v, 7) - 0.5;
      tile.set(u, v, palette.mix(middle + (mottle * 1.6) + (detail * 0.7) + (grain * 0.35)));
    });
    for (let pebble = 0; pebble < 7; pebble++) {
      const u = Math.floor(tile.noise(pebble, 0, 8) * tile.size);
      const v = Math.floor(tile.noise(pebble, 1, 9) * tile.size);
      tile.set(u, v, palette.mix(palette.size - 1.5));
      tile.set(u + 1, v, palette.mix(palette.size - 2));
      tile.set(u, v + 1, palette.mix(1));
      tile.set(u + 1, v + 1, palette.mix(0.5));
    }
  };
}

export function ripples(
  palette: Palette,
  wavelength = 8
): TilePainter {
  const middle = (palette.size - 1) / 2;

  return (tile) => tile.each((u, v) => {
    const bend = tile.smoothNoise(u, v, 16, 10) * wavelength;
    const phase = (v + (u * wavelength / tile.size) + bend) / wavelength * Math.PI * 2;
    const ripple = Math.sign(Math.sin(phase)) * (Math.abs(Math.sin(phase)) ** 0.6);
    tile.set(u, v, palette.mix(middle + (ripple * 0.9) + ((tile.noise(u, v, 11) - 0.5) * 0.35)));
  });
}

export function water(
  palette: Palette,
  wavelength = 16
): TilePainter {
  const middle = (palette.size - 1) / 2;

  return (tile) => tile.each((u, v) => {
    const bend = tile.smoothNoise(u, v, 16, 10) * wavelength * 0.5;
    const phase = (v + (u * wavelength / tile.size) + bend) / wavelength * Math.PI * 2;
    const swell = tile.smoothNoise(u, v, 8, 11) - 0.5;
    tile.set(u, v, palette.mix(middle + (Math.sin(phase) * 0.5) + (swell * 0.4)));
  });
}

export function rock(
  palette: Palette
): TilePainter {
  return (tile) => {
    const seeds = voronoiSeeds(tile, kRockCells);

    tile.each((u, v) => {
      const gap = voronoiGap(tile, seeds, u, v);
      const bedding = Math.sin(
        (v + (tile.smoothNoise(u, v, 16, 5) * 6)) / tile.size * Math.PI * 4
      ) * 0.3;
      let level = 2 + bedding + ((tile.smoothNoise(u, v, 8, 2) - 0.5) * 1.2);
      if (gap < 1.2) {
        level -= 1.1;
      }
      else if (gap < 2.6) {
        level -= 0.4;
      }
      tile.set(u, v, palette.mix(level));
    });
  };
}

export function snow(
  palette: Palette
): TilePainter {
  const top = palette.size - 1;

  return (tile) => {
    tile.each((u, v) => {
      const drift = tile.smoothNoise(u, v, 16, 20) - 0.5;
      const crust = tile.smoothNoise(u, v, 4, 21) - 0.5;
      tile.set(u, v, palette.mix(top - 1.6 + (drift * 1.4) + (crust * 0.5)));
    });
    for (let sparkle = 0; sparkle < 18; sparkle++) {
      const u = Math.floor(tile.noise(sparkle, 0, 22) * tile.size);
      const v = Math.floor(tile.noise(sparkle, 1, 23) * tile.size);
      tile.set(u, v, palette.mix(top));
      tile.set(u + 1, v + 1, palette.mix(top - 2.5));
    }
  };
}

export function bark(
  palette: Palette
): TilePainter {
  return (tile) => tile.each((u, v) => {
    const wobble = Math.round((tile.smoothNoise(0, v, 8, 12) - 0.5) * 3);
    const groove = tile.wrap(u + wobble) % 6;
    const level = groove === 0 ? 0.4 : 2 - (Math.abs(groove - 3) * 0.3);
    tile.set(u, v, palette.mix(level + ((tile.noise(u, v, 13) - 0.5) * 0.6)));
  });
}

export function birchBark(
  palette: Palette
): TilePainter {
  const top = palette.size - 1;

  return (tile) => {
    tile.each((u, v) => {
      const streak = tile.smoothNoise(u, v, 4, 27) - 0.5;
      tile.set(u, v, palette.mix(top - 0.8 + (streak * 0.8) + ((tile.noise(u, v, 28) - 0.5) * 0.3)));
    });
    for (let mark = 0; mark < 14; mark++) {
      const u = Math.floor(tile.noise(mark, 0, 29) * tile.size);
      const v = Math.floor(tile.noise(mark, 1, 30) * tile.size);
      const length = 2 + Math.floor(tile.noise(mark, 2, 31) * 5);
      for (let step = 0; step < length; step++) {
        const edge = step === 0 || step === length - 1;
        tile.set(u + step, v, palette.mix(edge ? 1 : 0));
      }
    }
  };
}

export function logEnd(
  wood: Palette,
  rim: Palette
): TilePainter {
  return (tile) => {
    const centre = (tile.size - 1) / 2;

    tile.each((u, v) => {
      const distance = Math.hypot(u - centre, v - centre) +
        ((tile.smoothNoise(u, v, 8, 24) - 0.5) * 2);
      if (distance >= (tile.size / 2) - 2) {
        tile.set(u, v, rim.mix(1 + ((tile.noise(u, v, 25) - 0.5) * 0.8)));

        return;
      }

      const ring = distance % 4;
      const level = ring < 1 ? 1 : 3 - (ring * 0.25);
      tile.set(u, v, wood.mix(level + ((tile.noise(u, v, 26) - 0.5) * 0.4)));
    });
  };
}

export function foliage(
  palette: Palette
): TilePainter {
  return (tile) => {
    tile.each((u, v) => {
      const cluster = tile.smoothNoise(u, v, 8, 14);
      if (tile.smoothNoise(u, v, 4, 15) < 0.16 && cluster < 0.5) {
        tile.set(u, v, TRANSPARENT);

        return;
      }
      tile.set(u, v, palette.mix(0.7 + (cluster * 1.4) + ((tile.noise(u, v, 16) - 0.5) * 0.2)));
    });
    for (let leaf = 0; leaf < 30; leaf++) {
      const u = Math.floor(tile.noise(leaf, 0, 17) * tile.size);
      const v = Math.floor(tile.noise(leaf, 1, 18) * tile.size);
      const tone = 2.6 + (tile.noise(leaf, 2, 19) * 1.6);
      tile.set(u, v - 1, palette.mix(tone + 0.5));
      tile.set(u - 1, v, palette.mix(tone + 0.3));
      tile.set(u, v, palette.mix(tone));
      tile.set(u + 1, v, palette.mix(tone - 0.5));
      tile.set(u, v + 1, palette.mix(tone - 0.9));
    }
  };
}

function stroke(
  tile: TileCanvas,
  palette: Palette,
  blade: number,
  tone: number,
  length: number
): void {
  const rootU = Math.floor(tile.noise(blade, 0, 4) * tile.size);
  const rootV = Math.floor(tile.noise(blade, 1, 5) * tile.size);
  const lean = tile.noise(blade, 3, 7) > 0.5 ? 1 : -1;

  for (let step = 0; step < length; step++) {
    const u = rootU + (step >= Math.ceil(length / 2) ? lean : 0);
    tile.set(u, rootV - step, palette.mix(tone + ((step / length) * 0.7)));
  }
}

function fringeDepth(
  tile: TileCanvas,
  u: number
): number {
  const base = 7 + Math.round(tile.smoothNoise(u, 0, 16, 3) * 3);
  const phase = tile.wrap(u) % 4;
  const reach = 1 + (tile.noise(Math.floor(u / 4), 0, 8) * 4);
  const point = [0.35, 1, 0.55, 0][phase];

  return base + Math.round(point * reach);
}

function voronoiSeeds(
  tile: TileCanvas,
  count: number
): VoronoiSeed[] {
  return Array.from({ length: count }, (_, index) => {
    return {
      x: hash(index, 0, 11, tile.seed) * tile.size,
      y: hash(index, 0, 12, tile.seed) * tile.size
    };
  });
}

function voronoiGap(
  { size }: TileCanvas,
  seeds: VoronoiSeed[],
  u: number,
  v: number
): number {
  let first = Infinity;
  let second = Infinity;

  for (const seed of seeds) {
    const distance = Math.hypot(
      torusDelta(u + 0.5 - seed.x, size),
      torusDelta(v + 0.5 - seed.y, size)
    );
    if (distance < first) {
      second = first;
      first = distance;
    }
    else if (distance < second) {
      second = distance;
    }
  }

  return second - first;
}

function torusDelta(
  delta: number,
  size: number
): number {
  const half = size / 2;

  return ((((delta + half) % size) + size) % size) - half;
}
