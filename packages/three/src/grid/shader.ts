// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  Fn,
  uniform,
  positionWorld,
  positionView,
  positionLocal,
  cameraPosition,
  cameraWorldMatrix,
  normalize,
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
import {
  type GridPlane,
  getPlaneAxes
} from "./GridPlaneValue.ts";

// CONSTANTS
const kDiscardThreshold = 0.003;

/**
 * `"lines"` draws continuous grid lines.
 * `"cross"` draws short plus marks at intersections.
 */
export type GridStyle = "lines" | "cross";

/**
 * `"camera"` fades around the camera's in-plane position.
 * `"origin"` fades around the plane origin.
 * `"target"` fades around the target and falls back to the camera when cleared.
 */
export type GridFadeFrom = "camera" | "origin" | "target";

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
  offset: number;
}

/**
 * Builds uniforms for the live `Grid` properties.
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
    zAxisColor: uniform(new THREE.Color(options.zAxisColor)),
    offset: uniform(options.offset, "float"),
    // `Grid` updates this fade anchor every frame in target mode.
    targetPosition: uniform(new THREE.Vector3())
  };
}

export type GridUniforms = ReturnType<typeof createGridUniforms>;

/**
 * AA grid-line test from Bgolus's "Pristine Grid".
 * `uv` is cell-scaled; `lineWidthPx` is in pixels.
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
  const line = smoothstep(
    drawWidth.add(lineAA),
    drawWidth.sub(lineAA),
    invGrid
  )
    .mul(saturate(targetWidth.div(drawWidth)));

  // Below one derivative pixel, blend toward a flat fill.
  const blendFactor = saturate(uvDeriv.mul(2).sub(1));
  const blended = line.add(
    targetWidth.sub(line).mul(blendFactor)
  );

  return max(blended.x, blended.y);
});

/**
 * Cross variant of `pristineGrid`.
 * `armLength` is the half-arm length in cell units (0-0.5).
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
  const line = smoothstep(
    drawWidth.add(lineAA),
    drawWidth.sub(lineAA),
    invGrid
  )
    .mul(saturate(targetWidth.div(drawWidth)));

  const blendFactor = saturate(uvDeriv.mul(2).sub(1));
  const blended = line.add(
    targetWidth.sub(line).mul(blendFactor)
  );

  // Window each line to a short arm.
  const armAA = max(uvDeriv.mul(1.5), vec2(0.0001));
  const armEdge = vec2(float(1).sub(armLength.mul(2)));
  const arm = smoothstep(
    armEdge.sub(armAA),
    armEdge.add(armAA),
    gridUV
  );

  return max(
    blended.x.mul(arm.y),
    blended.y.mul(arm.x)
  );
});

/**
 * 1D AA line test for axis highlighting.
 */
const axisLine = Fn(([coord, widthPx]: [Node<"float">, Node<"float">]) => {
  const halfWidth = max(
    fwidth(coord).mul(widthPx).mul(0.5),
    0.0001
  );

  return float(1).sub(
    smoothstep(0, halfWidth, abs(coord))
  );
});

/**
 * Hard per-cell cutoff for `hideCellOnSection` on cross cells.
 */
const hardLatticeMask = Fn(([cellIndex, sectionSize]: [Node<"vec2">, Node<"float">]) => {
  const onLattice = or(
    abs(mod(round(cellIndex.x), sectionSize)).lessThan(0.5),
    abs(mod(round(cellIndex.y), sectionSize)).lessThan(0.5)
  );

  return select(
    onLattice,
    float(1),
    float(0)
  );
});

/**
 * Soft per-cell falloff for `hideCellOnSection` on line cells.
 */
const softLatticeMask = Fn(([cellIndex, sectionSize, fadeWidth]: [Node<"vec2">, Node<"float">, Node<"float">]) => {
  const halfSection = sectionSize.mul(0.5);
  const distToLatticeX = abs(
    mod(cellIndex.x.add(halfSection), sectionSize).sub(halfSection)
  );
  const distToLatticeY = abs(
    mod(cellIndex.y.add(halfSection), sectionSize).sub(halfSection)
  );
  const width = clamp(fadeWidth, 0.0001, halfSection);

  return max(
    float(1).sub(smoothstep(0, width, distToLatticeX)),
    float(1).sub(smoothstep(0, width, distToLatticeY))
  );
});

interface PlaneComponents {
  u: Node<"float">;
  v: Node<"float">;
  /** Fade anchor's `u`/`v` (camera or `Grid.fade.target`, per `fadeFrom`). */
  anchorU: Node<"float">;
  anchorV: Node<"float">;
  /** Color along `u` (drawn where `v` crosses zero). */
  uAxisColor: GridUniforms["xAxisColor"];
  /** Color along `v` (drawn where `u` crosses zero). */
  vAxisColor: GridUniforms["xAxisColor"];
}

function pickAxisComponent(
  node: Node<"vec3">,
  axis: "x" | "y" | "z"
): Node<"float"> {
  switch (axis) {
    case "x":
      return node.x;
    case "y":
      return node.y;
    case "z":
    default:
      return node.z;
  }
}

function axisColorUniform(
  uniforms: GridUniforms,
  axis: "x" | "y" | "z"
): GridUniforms["xAxisColor"] {
  switch (axis) {
    case "x":
      return uniforms.xAxisColor;
    case "y":
      return uniforms.yAxisColor;
    case "z":
    default:
      return uniforms.zAxisColor;
  }
}

function pickPlaneComponents(
  plane: GridPlane,
  uniforms: GridUniforms,
  positionSource: Node<"vec3">,
  anchor: Node<"vec3">
): PlaneComponents {
  const { u, v } = getPlaneAxes(plane);

  return {
    u: pickAxisComponent(positionSource, u),
    v: pickAxisComponent(positionSource, v),
    anchorU: pickAxisComponent(anchor, u),
    anchorV: pickAxisComponent(anchor, v),
    uAxisColor: axisColorUniform(uniforms, u),
    vAxisColor: axisColorUniform(uniforms, v)
  };
}

/**
 * Reconstructs the world hit point for `infiniteGrid`.
 */
function buildInfiniteWorldHit(
  plane: GridPlane,
  uniforms: GridUniforms
): Node<"vec3"> {
  const { normal } = getPlaneAxes(plane);

  const worldPos = cameraWorldMatrix.mul(
    vec4(positionView, float(1))
  ).xyz;
  const rayDir = normalize(
    worldPos.sub(cameraPosition)
  );

  const camNormal = pickAxisComponent(
    cameraPosition,
    normal
  );
  const rayNormal = pickAxisComponent(
    rayDir,
    normal
  );
  const t = uniforms.offset
    .sub(camNormal)
    .div(rayNormal);

  If(t.lessThanEqual(0), () => {
    Discard();
  });

  return cameraPosition.add(rayDir.mul(t));
}

export interface BuildGridMaterialOptions {
  plane: GridPlane;
  cellStyle: GridStyle;
  sectionStyle: GridStyle;
  uniforms: GridUniforms;
  fadeFrom: GridFadeFrom;
  infiniteGrid: boolean;
}

/**
 * Builds the grid material.
 */
export function buildGridMaterial(
  options: BuildGridMaterialOptions
): THREE.MeshBasicNodeMaterial {
  const {
    plane, cellStyle, sectionStyle, uniforms, fadeFrom, infiniteGrid
  } = options;

  const material = new THREE.MeshBasicNodeMaterial();

  if (infiniteGrid) {
    // Full-viewport quad in clip space.
    material.vertexNode = vec4(
      positionLocal.xy,
      float(1),
      float(1)
    );
  }

  const colorNode = Fn(() => {
    const positionSource = infiniteGrid ?
      buildInfiniteWorldHit(plane, uniforms) :
      positionWorld;
    const anchor = fadeFrom === "target" ? uniforms.targetPosition : cameraPosition;
    const {
      u, v, anchorU, anchorV, uAxisColor, vAxisColor
    } = pickPlaneComponents(plane, uniforms, positionSource, anchor);

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

    // Fade out the fine grid once it goes sub-pixel.
    const fineDeriv = fwidth(worldUV.div(uniforms.cellSize));
    const fineFade = saturate(
      float(1).sub(max(fineDeriv.x, fineDeriv.y))
    );

    // Test section overlap at cell granularity.
    const cellIndex = worldUV.div(uniforms.cellSize);
    const sectionLatticeMask = cellStyle === "cross" ?
      hardLatticeMask(cellIndex, uniforms.sectionSize) :
      softLatticeMask(
        cellIndex,
        uniforms.sectionSize,
        uniforms.hideCellOnSectionFadeWidth
      );

    // Hide the fine grid where the section grid covers it.
    const fineSectionMask = mix(
      float(1),
      float(1).sub(sectionLatticeMask),
      uniforms.hideCellOnSection
    );
    const fadedFine = fineLine
      .mul(fineFade)
      .mul(fineSectionMask);

    const gridMask = max(fadedFine, sectionLine);
    const gridColor = mix(
      uniforms.cellColor,
      uniforms.sectionColor,
      sectionLine
    );

    const uAxisMask = axisLine(v, uniforms.axisThickness)
      .mul(uniforms.showAxes);
    const vAxisMask = axisLine(u, uniforms.axisThickness)
      .mul(uniforms.showAxes);
    const withUAxis = mix(gridColor, uAxisColor, uAxisMask);
    const finalColor = mix(withUAxis, vAxisColor, vAxisMask);
    const maskWithAxes = max(
      gridMask, max(uAxisMask, vAxisMask)
    );

    const dist = fadeFrom === "origin" ?
      length(vec2(u, v)) :
      length(vec2(u.sub(anchorU), v.sub(anchorV)));
    const fade = pow(
      saturate(
        float(1).sub(dist.div(uniforms.fadeDistance))
      ),
      uniforms.fadeStrength
    );
    const alpha = maskWithAxes.mul(fade);

    If(alpha.lessThan(kDiscardThreshold), () => {
      Discard();
    });

    return vec4(finalColor, alpha);
  })();

  material.colorNode = colorNode;
  material.transparent = true;
  material.depthWrite = false;
  material.side = THREE.FrontSide;

  return material;
}
