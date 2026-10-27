// Import Third-party Dependencies
import type { Node } from "three/webgpu";
import {
  abs,
  dot,
  float,
  floor,
  fract,
  int,
  Loop,
  pow,
  select,
  vec2,
  vec3,
  vec4
} from "three/tsl";

// CONSTANTS
const kStochasticCells = 3.4641016;
const kStochasticSharpness = 3;
const kTriplanarSharpness = 4;
const kTopAxis = 1;

type IntNode = Node<"int">;
type FloatNode = Node<"float">;
type Vec2Node = Node<"vec2">;
type Vec3Node = Node<"vec3">;
type Vec4Node = Node<"vec4">;
type BoolNode = Node<"bool">;

export type MapReader = (uv: Vec2Node, dx: Vec2Node, dy: Vec2Node) => Vec4Node;
export type ProjectionReader = (sample: Vec4Node, axis: IntNode) => Vec4Node;

export interface SurfaceSampling {
  point: Vec3Node;
  dx: Vec3Node;
  dy: Vec3Node;
  triplanar: BoolNode;
  stochastic: BoolNode;
  weights: Vec3Node;
}

function hash22(
  cell: Vec2Node
): Vec2Node {
  const seed = fract(vec3(cell.x, cell.y, cell.x).mul(vec3(0.1031, 0.103, 0.0973)));
  const mixed = seed.add(dot(seed, seed.yzx.add(33.33)));

  return fract(mixed.xx.add(mixed.yz).mul(mixed.zy));
}

function pick<T extends Node>(
  index: IntNode,
  [first, second, third]: readonly [T, T, T]
): T {
  return select(index.equal(int(0)), first, select(index.equal(int(1)), second, third)) as T;
}

function range(
  name: string,
  three: BoolNode
) {
  return {
    start: int(0),
    end: select(three, int(3), int(1)),
    type: "int",
    condition: "<",
    name
  } as const;
}

function loopVariable(
  inputs: object,
  name: string
): IntNode {
  return (inputs as Record<string, IntNode>)[name];
}

function stochasticCells(
  uv: Vec2Node
): { offsets: [Vec2Node, Vec2Node, Vec2Node]; weights: Vec3Node; } {
  const skewed = vec2(uv.x, uv.y.mul(1.15470054).sub(uv.x.mul(0.57735027))).mul(kStochasticCells);
  const base = floor(skewed);
  const local = fract(skewed);
  const rest = float(1).sub(local.x).sub(local.y);
  const upper = rest.lessThan(0);
  const weights = pow(select(
    upper,
    vec3(rest.negate(), float(1).sub(local.y), float(1).sub(local.x)),
    vec3(rest, local.y, local.x)
  ), vec3(kStochasticSharpness));

  return {
    offsets: [
      hash22(select(upper, base.add(1), base)),
      hash22(select(upper, base.add(vec2(1, 0)), base.add(vec2(0, 1)))),
      hash22(select(upper, base.add(vec2(0, 1)), base.add(vec2(1, 0))))
    ],
    weights: weights.div(weights.x.add(weights.y).add(weights.z))
  };
}

export function sampleSurface(
  read: MapReader,
  sampling: SurfaceSampling,
  project: ProjectionReader
): Vec4Node {
  const { point, dx, dy, triplanar, stochastic, weights } = sampling;
  const sum = vec4(0).toVar();
  Loop(range("axisIndex", triplanar), (projectionInputs) => {
    const axis = select(triplanar, loopVariable(projectionInputs, "axisIndex"), int(kTopAxis)).toVar();
    const uv = pick(axis, [point.zy, point.xz, point.xy]).toVar();
    const uvDx = pick(axis, [dx.zy, dx.xz, dx.xy]).toVar();
    const uvDy = pick(axis, [dy.zy, dy.xz, dy.xy]).toVar();
    const grid = stochasticCells(uv);
    const sample = vec4(0).toVar();
    Loop(range("cell", stochastic), (cellInputs) => {
      const cell = loopVariable(cellInputs, "cell");
      const offset = select(stochastic, pick(cell, grid.offsets), vec2(0));
      const weight = select(
        stochastic,
        pick<FloatNode>(cell, [grid.weights.x, grid.weights.y, grid.weights.z]),
        float(1)
      );
      sample.addAssign(read(uv.add(offset), uvDx, uvDy).mul(weight));
    });
    const share = select(triplanar, pick<FloatNode>(axis, [weights.x, weights.y, weights.z]), float(1));
    sum.addAssign(project(sample, axis).mul(share));
  });

  return sum;
}

export function triplanarWeights(
  normal: Vec3Node
): Vec3Node {
  const weights = pow(abs(normal), vec3(kTriplanarSharpness));

  return weights.div(weights.x.add(weights.y).add(weights.z));
}

export function whiteoutNormal(
  normal: Vec3Node,
  detail: Vec3Node,
  axis: IntNode
): Vec3Node {
  return pick(axis, [
    vec3(detail.xy.add(normal.zy), abs(detail.z).mul(normal.x)).zyx,
    vec3(detail.xy.add(normal.xz), abs(detail.z).mul(normal.y)).xzy,
    vec3(detail.xy.add(normal.xy), abs(detail.z).mul(normal.z))
  ]);
}
