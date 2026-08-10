// Import Internal Dependencies
import { CanvasBuffer } from "../../src/buffer/CanvasBuffer.ts";
import { CanvasRenderer } from "../../src/rendering/CanvasRenderer.ts";
import { Viewport } from "../../src/rendering/Viewport.ts";
import type {
  RGBA,
  Vec2
} from "../../src/types.ts";

// CONSTANTS
const kBlack: RGBA = { r: 0, g: 0, b: 0, a: 255 };
const kBlue: RGBA = { r: 0, g: 0, b: 255, a: 255 };
const kRed: RGBA = { r: 255, g: 0, b: 0, a: 255 };

export interface BrowserBenchmarkResult {
  task: string;
  "p50 (ms)": number;
  "p99 (ms)": number;
  samples: number;
}

export interface BrowserBenchmarkReport {
  runtime: {
    userAgent: string;
  };
  results: BrowserBenchmarkResult[];
}

function percentile(
  sorted: number[],
  fraction: number
): number {
  const index = Math.floor((sorted.length - 1) * fraction);

  return sorted[index];
}

function measure(
  task: string,
  fn: () => void,
  samples = 100,
  operationsPerSample = 1
): BrowserBenchmarkResult {
  for (let i = 0; i < 20; i++) {
    for (let operation = 0; operation < operationsPerSample; operation++) {
      fn();
    }
  }

  const timings = new Array<number>(samples);
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    for (let operation = 0; operation < operationsPerSample; operation++) {
      fn();
    }
    timings[i] = (performance.now() - start) / operationsPerSample;
  }
  timings.sort((a, b) => a - b);

  return {
    task,
    "p50 (ms)": Number(percentile(timings, 0.5).toFixed(4)),
    "p99 (ms)": Number(percentile(timings, 0.99).toFixed(4)),
    samples
  };
}

function rectanglePositions(
  width: number,
  height: number
): Vec2[] {
  const positions: Vec2[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      positions.push({ x, y });
    }
  }

  return positions;
}

function runBenchmarks(): BrowserBenchmarkReport {
  const size = { x: 256, y: 256 };
  const buffer = new CanvasBuffer({ size, maxSize: 256 });
  const compactStroke = rectanglePositions(8, 8);
  const diagonalStroke = Array.from(
    { length: 256 },
    (_, value) => {
      return { x: value, y: value };
    }
  );
  const variedPositions = rectanglePositions(64, 64);
  const colorGroups = [kBlack, kBlue, kRed, { ...kBlack, a: 0 }].map(
    (color, groupIndex) => {
      return {
        color,
        positions: variedPositions.filter(
          (_, index) => index % 4 === groupIndex
        )
      };
    }
  );
  const viewport = new Viewport({ textureSize: size, zoom: 2 });
  viewport.updateCanvasSize(1024, 768);
  viewport.centerTexture();
  const renderer = new CanvasRenderer({
    viewport,
    canvasBuffer: buffer
  });
  renderer.resize(1024, 768);
  const rendererContext = renderer.canvas().getContext("2d")!;

  let alternate = false;
  const results = [
    measure(
      "CanvasBuffer.drawPixels / compact 8x8",
      () => {
        alternate = !alternate;
        buffer.drawPixels(compactStroke, alternate ? kBlack : kBlue);
      },
      100,
      100
    ),
    measure(
      "CanvasBuffer.drawPixels / sparse 256px diagonal",
      () => {
        alternate = !alternate;
        buffer.drawPixels(diagonalStroke, alternate ? kBlack : kBlue);
      },
      100,
      20
    ),
    measure(
      "CanvasBuffer.drawColorGroups / 4096px, 4 colors",
      () => buffer.drawColorGroups(colorGroups),
      100,
      20
    ),
    measure(
      "CanvasRenderer.drawFrame / 1024x768 viewport",
      () => renderer.drawFrame(),
      100,
      100
    ),
    measure(
      "CanvasRenderer.drawFrame + readback / 1024x768 viewport",
      () => {
        renderer.drawFrame();
        rendererContext.getImageData(0, 0, 1, 1);
      },
      100,
      20
    )
  ];

  return {
    runtime: { userAgent: navigator.userAgent },
    results
  };
}

declare global {
  interface Window {
    runPixelDrawBenchmarks: () => BrowserBenchmarkReport;
  }
}

window.runPixelDrawBenchmarks = runBenchmarks;
