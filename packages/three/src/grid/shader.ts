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

export type GridStyle = "lines" | "cross";

export type GridFadeFrom = "camera" | "origin" | "target";

export interface GridUniformOptions {
  cellSize: number;
  sectionSize: number;
  cellColor: THREE.ColorRepresentation;
  sectionColor: THREE.ColorRepresentation;
  cellThickness: number;
  sectionThickness: number;
  showSection: boolean;
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
    showSection: uniform(options.showSection ? 1 : 0, "float"),
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
    targetPosition: uniform(new THREE.Vector3())
  };
}

export type GridUniforms = ReturnType<typeof createGridUniforms>;

interface GridLines {
  blended: Node<"vec2">;
  gridUV: Node<"vec2">;
}

function gridLines(
  uv: Node<"vec2">,
  uvDeriv: Node<"vec2">,
  lineWidthPx: Node<"float">
): GridLines {
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

  return { blended, gridUV };
}

function pristineGrid(
  uv: Node<"vec2">,
  uvDeriv: Node<"vec2">,
  lineWidthPx: Node<"float">
): Node<"float"> {
  const { blended } = gridLines(uv, uvDeriv, lineWidthPx);

  return max(blended.x, blended.y);
}

function pristineCross(
  uv: Node<"vec2">,
  uvDeriv: Node<"vec2">,
  lineWidthPx: Node<"float">,
  armLength: Node<"float">
): Node<"float"> {
  const { blended, gridUV } = gridLines(uv, uvDeriv, lineWidthPx);

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
}

function gridPattern(
  style: GridStyle,
  uv: Node<"vec2">,
  uvDeriv: Node<"vec2">,
  lineWidthPx: Node<"float">,
  armLength: Node<"float">
): Node<"float"> {
  return style === "cross" ?
    pristineCross(uv, uvDeriv, lineWidthPx, armLength) :
    pristineGrid(uv, uvDeriv, lineWidthPx);
}

function axisLine(
  coord: Node<"float">,
  coordWidth: Node<"float">,
  widthPx: Node<"float">
): Node<"float"> {
  const halfWidth = max(
    coordWidth.mul(widthPx).mul(0.5),
    0.0001
  );

  return float(1).sub(
    smoothstep(0, halfWidth, abs(coord))
  );
}

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

const softLatticeMask = Fn((
  [cellIndex, sectionSize, fadeWidth]: [Node<"vec2">, Node<"float">, Node<"float">]
) => {
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
}
);

interface PlaneComponents {
  u: Node<"float">;
  v: Node<"float">;
  /**
   * Fade anchor's `u`/`v` (camera or `Grid.fade.target`, per `fadeFrom`).
   */
  anchorU: Node<"float">;
  anchorV: Node<"float">;
  /**
   * Color along `u` (drawn where `v` crosses zero).
   */
  uAxisColor: GridUniforms["xAxisColor"];
  /**
   * Color along `v` (drawn where `u` crosses zero).
   */
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
  doubleSided: boolean;
}

export function buildGridMaterial(
  options: BuildGridMaterialOptions
): THREE.MeshBasicNodeMaterial {
  const {
    plane,
    cellStyle,
    sectionStyle,
    uniforms,
    fadeFrom,
    infiniteGrid,
    doubleSided
  } = options;

  const material = new THREE.MeshBasicNodeMaterial();

  if (infiniteGrid) {
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
    const worldDx = dFdx(worldUV).toVar();
    const worldDy = dFdy(worldUV).toVar();

    const dist = fadeFrom === "origin" ?
      length(vec2(u, v)) :
      length(vec2(u.sub(anchorU), v.sub(anchorV)));
    If(dist.greaterThanEqual(uniforms.fadeDistance), () => {
      Discard();
    });

    const worldDeriv = vec2(
      length(vec2(worldDx.x, worldDy.x)),
      length(vec2(worldDx.y, worldDy.y))
    );
    const worldWidth = abs(worldDx).add(abs(worldDy));
    const sectionScale = uniforms.cellSize.mul(uniforms.sectionSize);

    const fineLine = gridPattern(
      cellStyle,
      worldUV.div(uniforms.cellSize),
      worldDeriv.div(uniforms.cellSize),
      uniforms.cellThickness,
      uniforms.crossSize
    );
    const sectionLine = gridPattern(
      sectionStyle,
      worldUV.div(sectionScale),
      worldDeriv.div(sectionScale),
      uniforms.sectionThickness,
      uniforms.crossSize
    ).mul(uniforms.showSection);

    const fineDeriv = worldWidth.div(uniforms.cellSize);
    const fineFade = saturate(
      float(1).sub(max(fineDeriv.x, fineDeriv.y))
    );

    const cellIndex = worldUV.div(uniforms.cellSize);
    const sectionLatticeMask = cellStyle === "cross" ?
      hardLatticeMask(cellIndex, uniforms.sectionSize) :
      softLatticeMask(
        cellIndex,
        uniforms.sectionSize,
        uniforms.hideCellOnSectionFadeWidth
      );

    const hideCellOnSection = uniforms.hideCellOnSection
      .mul(uniforms.showSection);
    const fineSectionMask = mix(
      float(1),
      float(1).sub(sectionLatticeMask),
      hideCellOnSection
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

    const uAxisMask = axisLine(v, worldWidth.y, uniforms.axisThickness)
      .mul(uniforms.showAxes);
    const vAxisMask = axisLine(u, worldWidth.x, uniforms.axisThickness)
      .mul(uniforms.showAxes);
    const withUAxis = mix(gridColor, uAxisColor, uAxisMask);
    const finalColor = mix(withUAxis, vAxisColor, vAxisMask);
    const maskWithAxes = max(gridMask, max(uAxisMask, vAxisMask));

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
  material.side = doubleSided ? THREE.DoubleSide : THREE.FrontSide;

  return material;
}
