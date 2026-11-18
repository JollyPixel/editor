// Import Third-party Dependencies
import * as THREE from "three";
import {
  LineSegmentsGeometry
} from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { Line2NodeMaterial } from "three/webgpu";

// Import Internal Dependencies
import { fadeMaterial } from "./fadeMaterial.ts";
import {
  PickableLines,
  UnpickableLines
} from "./PickableLines.ts";

// CONSTANTS
const kHaloColor = new THREE.Color("#0b0d10");
const kCoreWidth = 2;
const kHaloWidth = 5;
const kHiddenWidth = 1.5;
const kHiddenDimming = 0.6;
const kDepthBias = 2;
const kFirstRenderOrder = 1;

interface StrokeOptions {
  color: THREE.ColorRepresentation;
  width: number;
  depthFunc: THREE.DepthModes;
  writes: "color" | "depth";
}

export class HaloLines extends THREE.Group {
  #geometry = new LineSegmentsGeometry();
  readonly #hidden: LineSegments2;
  readonly #core: LineSegments2;
  readonly #colorStrokes: ReadonlyArray<LineSegments2>;
  readonly #strokes: ReadonlyArray<LineSegments2>;

  constructor(
    color: THREE.ColorRepresentation
  ) {
    super();

    this.#hidden = new UnpickableLines(this.#geometry, strokeMaterial({
      color: dimmed(color),
      width: kHiddenWidth,
      depthFunc: THREE.GreaterDepth,
      writes: "color"
    }));
    const halo = new UnpickableLines(this.#geometry, strokeMaterial({
      color: kHaloColor,
      width: kHaloWidth,
      depthFunc: THREE.LessEqualDepth,
      writes: "color"
    }));
    this.#core = new PickableLines(this.#geometry, strokeMaterial({
      color,
      width: kCoreWidth,
      depthFunc: THREE.LessEqualDepth,
      writes: "color"
    }));
    const depth = new UnpickableLines(this.#geometry, strokeMaterial({
      color: kHaloColor,
      width: kHaloWidth,
      depthFunc: THREE.LessEqualDepth,
      writes: "depth"
    }));
    this.#colorStrokes = [this.#hidden, halo, this.#core];
    this.#strokes = [...this.#colorStrokes, depth];
    for (const [index, stroke] of this.#strokes.entries()) {
      stroke.renderOrder = kFirstRenderOrder + index;
      stroke.visible = false;
    }
    this.add(...this.#strokes);
  }

  redraw(
    points: ReadonlyArray<THREE.Vector3>
  ): void {
    this.#geometry.dispose();
    this.#geometry = new LineSegmentsGeometry().setPositions(
      points.flatMap((point) => point.toArray())
    );
    for (const stroke of this.#strokes) {
      stroke.geometry = this.#geometry;
      stroke.visible = points.length > 0;
    }
  }

  paint(
    color: THREE.ColorRepresentation
  ): void {
    this.#core.material.color.set(color);
    this.#hidden.material.color.copy(dimmed(color));
  }

  fade(
    opacity: number
  ): void {
    for (const { material } of this.#colorStrokes) {
      fadeMaterial(material, opacity);
    }
  }

  override dispose(): void {
    this.#geometry.dispose();
    for (const { material } of this.#strokes) {
      material.dispose();
    }
  }
}

function dimmed(
  color: THREE.ColorRepresentation
): THREE.Color {
  return new THREE.Color(color).lerp(kHaloColor, kHiddenDimming);
}

function strokeMaterial(
  options: StrokeOptions
): Line2NodeMaterial {
  return new Line2NodeMaterial({
    color: options.color,
    linewidth: options.width,
    depthFunc: options.depthFunc,
    colorWrite: options.writes === "color",
    depthWrite: options.writes === "depth",
    alphaToCoverage: false,
    polygonOffset: true,
    polygonOffsetFactor: -kDepthBias,
    polygonOffsetUnits: -kDepthBias
  });
}
