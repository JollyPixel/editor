// Import Third-party Dependencies
import type { Node } from "three/webgpu";
import {
  abs,
  dot,
  float,
  floor,
  fract,
  If,
  normalize,
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

type Vec2Node = Node<"vec2">;
type Vec3Node = Node<"vec3">;
type Vec4Node = Node<"vec4">;
type BoolNode = Node<"bool">;

export type MapReader = (uv: Vec2Node, dx: Vec2Node, dy: Vec2Node) => Vec4Node;

function hash22(
  cell: Vec2Node
): Vec2Node {
  const seed = fract(vec3(cell.x, cell.y, cell.x).mul(vec3(0.1031, 0.103, 0.0973)));
  const mixed = seed.add(dot(seed, seed.yzx.add(33.33)));

  return fract(mixed.xx.add(mixed.yz).mul(mixed.zy));
}

export function stochasticSample(
  read: MapReader,
  uv: Vec2Node,
  dx: Vec2Node,
  dy: Vec2Node
): Vec4Node {
  const skewed = vec2(uv.x, uv.y.mul(1.15470054).sub(uv.x.mul(0.57735027))).mul(kStochasticCells);
  const base = floor(skewed);
  const local = fract(skewed);
  const rest = float(1).sub(local.x).sub(local.y);
  const upper = rest.lessThan(0);
  const weights = select(
    upper,
    vec3(rest.negate(), float(1).sub(local.y), float(1).sub(local.x)),
    vec3(rest, local.y, local.x)
  );
  const corners = [
    select(upper, base.add(1), base),
    select(upper, base.add(vec2(1, 0)), base.add(vec2(0, 1))),
    select(upper, base.add(vec2(0, 1)), base.add(vec2(1, 0)))
  ];
  const sharp = pow(weights, vec3(kStochasticSharpness));
  const total = sharp.x.add(sharp.y).add(sharp.z);
  const channels = ["x", "y", "z"] as const;

  return corners.reduce<Vec4Node>(
    (sum, corner, index) => sum.add(read(uv.add(hash22(corner)), dx, dy).mul(sharp[channels[index]])),
    vec4(0)
  ).div(total);
}

export function projectedSample(
  read: MapReader,
  uv: Vec2Node,
  dx: Vec2Node,
  dy: Vec2Node,
  stochastic: BoolNode
): Vec4Node {
  const value = vec4(0).toVar();
  If(stochastic, () => {
    value.assign(stochasticSample(read, uv, dx, dy));
  }).Else(() => {
    value.assign(read(uv, dx, dy));
  });

  return value;
}

export function triplanarSamples(
  read: MapReader,
  point: Vec3Node,
  dx: Vec3Node,
  dy: Vec3Node,
  stochastic: BoolNode
): [Vec4Node, Vec4Node, Vec4Node] {
  return [
    projectedSample(read, point.zy, dx.zy, dy.zy, stochastic),
    projectedSample(read, point.xz, dx.xz, dy.xz, stochastic),
    projectedSample(read, point.xy, dx.xy, dy.xy, stochastic)
  ];
}

export function triplanarWeights(
  normal: Vec3Node
): Vec3Node {
  const weights = pow(abs(normal), vec3(kTriplanarSharpness));

  return weights.div(weights.x.add(weights.y).add(weights.z));
}

export function whiteoutNormal(
  normal: Vec3Node,
  weights: Vec3Node,
  [side, top, front]: readonly [Vec3Node, Vec3Node, Vec3Node]
): Vec3Node {
  const fromSide = vec3(side.xy.add(normal.zy), abs(side.z).mul(normal.x)).zyx;
  const fromTop = vec3(top.xy.add(normal.xz), abs(top.z).mul(normal.y)).xzy;
  const fromFront = vec3(front.xy.add(normal.xy), abs(front.z).mul(normal.z));

  return normalize(fromSide.mul(weights.x).add(fromTop.mul(weights.y)).add(fromFront.mul(weights.z)));
}
