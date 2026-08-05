// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  Fn,
  uniform,
  positionWorld,
  cameraPosition,
  vec2,
  vec4,
  float,
  fract,
  abs,
  clamp,
  saturate,
  smoothstep,
  max,
  length,
  pow,
  mix,
  dFdx,
  dFdy,
  fwidth,
  round,
  mod,
  or,
  select,
  If,
  Discard
} from "three/tsl";
import type { Node } from "three/webgpu";

// Import Internal Dependencies
import type { GridPlane } from "./GridPlaneValue.ts";

// CONSTANTS
const kDiscardThreshold = 0.003;

/**
 * `"lines"` draws continuous grid lines.
 * `"cross"` draws short plus-shaped marks at intersections.
 */
export type GridStyle = "lines" | "cross";

export interface GridUniformOptions {
  cellSize: number;
  sectionSize: number;
  cellColor: THREE.ColorRepresentation;
  sectionColor: THREE.ColorRepresentation;
  cellThickness: number;
  sectionThickness: number;
  crossSize: number;
  hideCellOnSection: boolean;
  hideCellOnSectionFadeWidth: number;
  fadeDistance: number;
  fadeStrength: number;
  showAxes: boolean;
  axisThickness: number;
  xAxisColor: THREE.ColorRepresentation;
  yAxisColor: THREE.ColorRepresentation;
  zAxisColor: THREE.ColorRepresentation;
}

/**
 * Creates uniforms for the live-tunable `Grid` properties.
 */
export function createGridUniforms(
  options: GridUniformOptions
) {
  return {
    cellSize: uniform(options.cellSize, "float"),
    sectionSize: uniform(options.sectionSize, "float"),
    cellColor: uniform(new THREE.Color(options.cellColor)),
    sectionColor: uniform(new THREE.Color(options.sectionColor)),
    cellThickness: uniform(options.cellThickness, "float"),
    sectionThickness: uniform(options.sectionThickness, "float"),
    crossSize: uniform(options.crossSize, "float"),
    hideCellOnSection: uniform(options.hideCellOnSection ? 1 : 0, "float"),
    hideCellOnSectionFadeWidth: uniform(options.hideCellOnSectionFadeWidth, "float"),
    fadeDistance: uniform(options.fadeDistance, "float"),
    fadeStrength: uniform(options.fadeStrength, "float"),
    showAxes: uniform(options.showAxes ? 1 : 0, "float"),
    axisThickness: uniform(options.axisThickness, "float"),
    xAxisColor: uniform(new THREE.Color(options.xAxisColor)),
    yAxisColor: uniform(new THREE.Color(options.yAxisColor)),
    zAxisColor: uniform(new THREE.Color(options.zAxisColor))
  };
}

export type GridUniforms = ReturnType<typeof createGridUniforms>;

/**
 * AA grid-line test from Bgolus's "pristine grid".
 * `uv` is pre-divided by cell size; `lineWidthPx` is in screen pixels.
 */
const pristineGrid = Fn(([uv, lineWidthPx]: [Node<"vec2">, Node<"float">]) => {
  const uvDeriv = vec2(
    length(vec2(dFdx(uv.x), dFdy(uv.x))),
    length(vec2(dFdx(uv.y), dFdy(uv.y)))
  );
  const targetWidth = uvDeriv.mul(lineWidthPx);
  const drawWidth = clamp(targetWidth, uvDeriv, vec2(0.5));
  const lineAA = max(uvDeriv.mul(1.5), vec2(0.0001));
  const gridUV = abs(fract(uv).mul(2).sub(1));
  const invGrid = float(1).sub(gridUV);
  const line = smoothstep(drawWidth.add(lineAA), drawWidth.sub(lineAA), invGrid)
    .mul(saturate(targetWidth.div(drawWidth)));

  // Below one derivative pixel, blend toward a flat fill instead of aliasing.
  const blendFactor = saturate(uvDeriv.mul(2).sub(1));
  const blended = line.add(targetWidth.sub(line).mul(blendFactor));

  return max(blended.x, blended.y);
});

/**
 * Cross variant of `pristineGrid`.
 * Each line is windowed to short arms around lattice points; `armLength` is
 * the half-length of each arm as a fraction of a cell (0-0.5).
 */
const pristineCross = Fn(([uv, lineWidthPx, armLength]: [Node<"vec2">, Node<"float">, Node<"float">]) => {
  const uvDeriv = vec2(
    length(vec2(dFdx(uv.x), dFdy(uv.x))),
    length(vec2(dFdx(uv.y), dFdy(uv.y)))
  );
  const targetWidth = uvDeriv.mul(lineWidthPx);
  const drawWidth = clamp(targetWidth, uvDeriv, vec2(0.5));
  const lineAA = max(uvDeriv.mul(1.5), vec2(0.0001));
  const gridUV = abs(fract(uv).mul(2).sub(1));
  const invGrid = float(1).sub(gridUV);
  const line = smoothstep(drawWidth.add(lineAA), drawWidth.sub(lineAA), invGrid)
    .mul(saturate(targetWidth.div(drawWidth)));

  const blendFactor = saturate(uvDeriv.mul(2).sub(1));
  const blended = line.add(targetWidth.sub(line).mul(blendFactor));

  // Reuse `gridUV` on the opposite axis to window each line to a short arm.
  const armAA = max(uvDeriv.mul(1.5), vec2(0.0001));
  const armEdge = vec2(float(1).sub(armLength.mul(2)));
  const arm = smoothstep(armEdge.sub(armAA), armEdge.add(armAA), gridUV);

  return max(blended.x.mul(arm.y), blended.y.mul(arm.x));
});

/**
 * 1D AA line test used for axis highlighting.
 */
const axisLine = Fn(([coord, widthPx]: [Node<"float">, Node<"float">]) => {
  const halfWidth = max(fwidth(coord).mul(widthPx).mul(0.5), 0.0001);

  return float(1).sub(smoothstep(0, halfWidth, abs(coord)));
});

/**
 * Hard per-cell cutoff for `hideCellOnSection`: 1 when this fragment's cell
 * column/row sits on the section lattice, 0 otherwise. Used for `"cross"`
 * cell style — the arms are short, isolated marks, so a smooth falloff only
 * smears them into a visible artifact instead of cleanly erasing the ones
 * that overlap a section mark.
 */
const hardLatticeMask = Fn(([cellIndex, sectionSize]: [Node<"vec2">, Node<"float">]) => {
  const onLattice = or(
    abs(mod(round(cellIndex.x), sectionSize)).lessThan(0.5),
    abs(mod(round(cellIndex.y), sectionSize)).lessThan(0.5)
  );

  return select(onLattice, float(1), float(0));
});

/**
 * Smooth per-cell falloff for `hideCellOnSection`: 1 at the section
 * lattice, ramping to 0 over `fadeWidth` cells. Used for `"lines"` cell
 * style, whose continuous strokes look better fading out than vanishing
 * edge-on. `fadeWidth` is clamped to half a section so the ramp never
 * overshoots into the neighboring section line.
 */
const softLatticeMask = Fn(([cellIndex, sectionSize, fadeWidth]: [Node<"vec2">, Node<"float">, Node<"float">]) => {
  const halfSection = sectionSize.mul(0.5);
  const distToLatticeX = abs(mod(cellIndex.x.add(halfSection), sectionSize).sub(halfSection));
  const distToLatticeY = abs(mod(cellIndex.y.add(halfSection), sectionSize).sub(halfSection));
  const width = clamp(fadeWidth, 0.0001, halfSection);

  return max(
    float(1).sub(smoothstep(0, width, distToLatticeX)),
    float(1).sub(smoothstep(0, width, distToLatticeY))
  );
});

interface PlaneComponents {
  u: Node<"float">;
  v: Node<"float">;
  camU: Node<"float">;
  camV: Node<"float">;
  /** Line color along `u` (drawn where `v` crosses zero). */
  uAxisColor: GridUniforms["xAxisColor"];
  /** Line color along `v` (drawn where `u` crosses zero). */
  vAxisColor: GridUniforms["xAxisColor"];
}

function pickPlaneComponents(
  plane: GridPlane,
  uniforms: GridUniforms
): PlaneComponents {
  switch (plane) {
    case "xz":
      return {
        u: positionWorld.x,
        v: positionWorld.z,
        camU: cameraPosition.x,
        camV: cameraPosition.z,
        uAxisColor: uniforms.xAxisColor,
        vAxisColor: uniforms.zAxisColor
      };
    case "xy":
      return {
        u: positionWorld.x,
        v: positionWorld.y,
        camU: cameraPosition.x,
        camV: cameraPosition.y,
        uAxisColor: uniforms.xAxisColor,
        vAxisColor: uniforms.yAxisColor
      };
    case "yz":
    default:
      return {
        u: positionWorld.y,
        v: positionWorld.z,
        camU: cameraPosition.y,
        camV: cameraPosition.z,
        uAxisColor: uniforms.yAxisColor,
        vAxisColor: uniforms.zAxisColor
      };
  }
}

/**
 * Builds the grid material: fine and section lines, axis highlighting,
 * and distance fade-out.
 */
export function buildGridMaterial(
  plane: GridPlane,
  cellStyle: GridStyle,
  sectionStyle: GridStyle,
  uniforms: GridUniforms
): THREE.MeshBasicNodeMaterial {
  const {
    u, v, camU, camV, uAxisColor, vAxisColor
  } = pickPlaneComponents(plane, uniforms);

  const colorNode = Fn(() => {
    const worldUV = vec2(u, v);

    const fineLine = cellStyle === "cross" ?
      pristineCross(
        worldUV.div(uniforms.cellSize),
        uniforms.cellThickness,
        uniforms.crossSize
      ) :
      pristineGrid(
        worldUV.div(uniforms.cellSize),
        uniforms.cellThickness
      );
    const sectionLine = sectionStyle === "cross" ?
      pristineCross(
        worldUV.div(uniforms.cellSize.mul(uniforms.sectionSize)),
        uniforms.sectionThickness,
        uniforms.crossSize
      ) :
      pristineGrid(
        worldUV.div(uniforms.cellSize.mul(uniforms.sectionSize)),
        uniforms.sectionThickness
      );

    // Fade out the fine grid once its cells go sub-pixel.
    const fineDeriv = fwidth(worldUV.div(uniforms.cellSize));
    const fineFade = saturate(float(1).sub(max(fineDeriv.x, fineDeriv.y)));

    // Whether/how much this fragment's fine cell column/row coincides with a
    // section line, tested at cell-index granularity rather than by reusing
    // `sectionLine`'s AA'd pixel footprint — that footprint is only a couple
    // of screen pixels wide, far too thin to catch a "cross" cell style's
    // arms poking out past the section line they're centered on.
    const cellIndex = worldUV.div(uniforms.cellSize);
    const sectionLatticeMask = cellStyle === "cross" ?
      hardLatticeMask(cellIndex, uniforms.sectionSize) :
      softLatticeMask(cellIndex, uniforms.sectionSize, uniforms.hideCellOnSectionFadeWidth);

    // Hide the fine grid where the section grid already covers it.
    const fineSectionMask = mix(float(1), float(1).sub(sectionLatticeMask), uniforms.hideCellOnSection);
    const fadedFine = fineLine.mul(fineFade).mul(fineSectionMask);

    const gridMask = max(fadedFine, sectionLine);
    const gridColor = mix(uniforms.cellColor, uniforms.sectionColor, sectionLine);

    const uAxisMask = axisLine(v, uniforms.axisThickness).mul(uniforms.showAxes);
    const vAxisMask = axisLine(u, uniforms.axisThickness).mul(uniforms.showAxes);
    const withUAxis = mix(gridColor, uAxisColor, uAxisMask);
    const finalColor = mix(withUAxis, vAxisColor, vAxisMask);
    const maskWithAxes = max(gridMask, max(uAxisMask, vAxisMask));

    const dist = length(vec2(u.sub(camU), v.sub(camV)));
    const fade = pow(
      saturate(float(1).sub(dist.div(uniforms.fadeDistance))),
      uniforms.fadeStrength
    );
    const alpha = maskWithAxes.mul(fade);

    If(alpha.lessThan(kDiscardThreshold), () => {
      Discard();
    });

    return vec4(finalColor, alpha);
  })();

  const material = new THREE.MeshBasicNodeMaterial();
  material.colorNode = colorNode;
  material.transparent = true;
  material.depthWrite = false;
  material.side = THREE.FrontSide;

  return material;
}
