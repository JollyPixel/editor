// Import Third-party Dependencies
import type * as THREE from "three";
import type { Node } from "three/webgpu";
import {
  bool,
  dot,
  float,
  Fn,
  If,
  int,
  ivec2,
  Loop,
  max,
  mix,
  normalize,
  select,
  step,
  struct,
  texture,
  textureLoad,
  vec3,
  vec4
} from "three/tsl";

// Import Internal Dependencies
import {
  MATERIAL_MAP_BITS,
  MATERIAL_MAPS,
  MATERIAL_TECHNIQUE_BITS,
  type MaterialArrays,
  type MaterialMap,
  type MaterialTechnique
} from "../textures/MaterialTextureStore.ts";
import {
  sampleSurface,
  triplanarWeights,
  whiteoutNormal,
  type MapReader
} from "./materialSampling.ts";
import {
  MIN_SPLAT_WEIGHT,
  SPLAT_CHANNEL_NAMES,
  type SplatLayer
} from "./splatLayers.ts";

// CONSTANTS
const kAlbedo = vec3(0.42, 0.47, 0.33);
const kMinTiling = 1e-3;
const kDefaultRoughness = 1;
const kTriplanarStart = 0.95;
const kFlatHeight = 0.5;
const kHeightBlendDepth = 0.2;
const kSurface = struct({ albedo: "vec3", detail: "vec3", orm: "vec3" }, "TerrainSurface");

type BoolNode = Node<"bool">;
type FloatNode = Node<"float">;
type IntNode = Node<"int">;
type Vec3Node = Node<"vec3">;
type Vec4Node = Node<"vec4">;

export interface MaterialSurfaceTextures {
  materialSlots: THREE.DataTexture;
  materialArrays: MaterialArrays;
}

export interface MaterialSurfaceInput {
  layers: readonly SplatLayer[];
  normal: Vec3Node;
  tangent: Vec3Node;
  bitangent: Vec3Node;
  point: Vec3Node;
  pointDx: Vec3Node;
  pointDy: Vec3Node;
}

export interface MaterialSurface {
  albedo: Vec3Node;
  detail: Vec3Node;
  orm: Vec3Node;

  materialArrays(arrays: MaterialArrays): void;
}

export function materialSurface(
  textures: MaterialSurfaceTextures,
  input: MaterialSurfaceInput
): MaterialSurface {
  const { layers, normal: surfaceNormal, tangent, bitangent } = input;
  const steep = surfaceNormal.y.lessThan(kTriplanarStart);
  const arrayNodes = {
    albedo: texture(textures.materialArrays.albedo),
    normal: texture(textures.materialArrays.normal),
    orm: texture(textures.materialArrays.orm),
    height: texture(textures.materialArrays.height)
  };
  const surface = Fn(() => {
    const slots = vec4From(layers.map(({ slot }) => slot)).toVar();
    const weights = vec4From(layers.map(({ weight }) => weight)).toVar();
    const heights = vec4(kFlatHeight).toVar();
    const heightBlended = float(0).toVar();
    const normal = surfaceNormal.toVar();
    const frameTangent = tangent.toVar();
    const frameBitangent = bitangent.toVar();
    const projectionWeights = triplanarWeights(surfaceNormal).toVar();
    const isSteep = steep.toVar();
    const point = input.point.toVar();
    const pointX = input.pointDx.toVar();
    const pointY = input.pointDy.toVar();
    function slotMaterial(
      index: IntNode
    ) {
      const slotTexel = ivec2(int(component(slots, index)), int(0));
      const entry = textureLoad(textures.materialSlots, slotTexel).toVar();
      const maps = int(entry.z).toVar();
      const techniques = int(entry.w).toVar();
      const scale = float(1).div(max(entry.y, float(kMinTiling))).toVar();
      const layer = int(max(entry.x.sub(1), float(0))).toVar();
      const triplanar = uses(techniques, "triplanar").and(isSteep).toVar();

      return {
        present: entry.x.greaterThan(0.5),
        anyMap: maps.notEqual(int(0)),
        has: (map: MaterialMap) => maps.bitAnd(int(MATERIAL_MAP_BITS[map])).notEqual(int(0)),
        heightBlend: uses(techniques, "heightBlend"),
        triplanar,
        sampling: {
          point: point.mul(scale),
          dx: pointX.mul(scale),
          dy: pointY.mul(scale),
          triplanar,
          stochastic: uses(techniques, "stochastic"),
          weights: projectionWeights
        },
        read: (map: MaterialMap): MapReader => (uv, uvDx, uvDy) => arrayNodes[map].sample(uv)
          .depth(layer)
          .grad(uvDx, uvDy)
      };
    }
    const blended = dot(step(float(MIN_SPLAT_WEIGHT), weights), vec4(1)).greaterThan(1.5);
    If(blended, () => {
      Loop(4, ({ i }) => {
        If(component(weights, i).greaterThan(0), () => {
          const slot = slotMaterial(i);
          If(slot.present.not(), () => {
            weights.assign(withComponent(weights, i, float(0)));
          }).ElseIf(slot.heightBlend.and(slot.has("height")), () => {
            const { height } = sampleSurface({
              height: { read: slot.read("height"), enabled: bool(true), project: unchanged }
            }, slot.sampling);
            heights.assign(withComponent(heights, i, height.x));
            heightBlended.assign(1);
          });
        });
      });
      If(heightBlended.greaterThan(0.5), () => {
        const soft = weights.div(max(dot(weights, vec4(1)), float(MIN_SPLAT_WEIGHT)));
        const used = step(float(MIN_SPLAT_WEIGHT), soft);
        const unused = float(1).sub(used);
        const raised = soft.add(heights)
          .mul(used)
          .sub(unused)
          .toVar();
        const top = max(max(raised.x, raised.y), max(raised.z, raised.w)).sub(kHeightBlendDepth);
        weights.assign(max(raised.sub(top), vec4(0)).mul(used));
      });
    });

    const albedo = vec3(0).toVar();
    const detail = vec3(0).toVar();
    const orm = vec3(0).toVar();
    const total = float(0).toVar();
    function sampleLayer(
      slot: ReturnType<typeof slotMaterial>,
      layerAlbedo: Vec3Node,
      layerDetail: Vec3Node,
      layerOrm: Vec3Node
    ): void {
      const sums = sampleSurface({
        albedo: { read: slot.read("albedo"), enabled: slot.has("albedo"), project: unchanged },
        normal: {
          read: slot.read("normal"),
          enabled: slot.has("normal"),
          project: (sample, axis) => select(
            slot.triplanar,
            vec4(whiteoutNormal(normal, unpackNormal(sample), axis), 1),
            vec4(unpackNormal(sample), 1)
          )
        },
        orm: { read: slot.read("orm"), enabled: slot.has("orm"), project: unchanged }
      }, slot.sampling);
      If(slot.has("albedo"), () => {
        layerAlbedo.assign(sums.albedo.rgb);
      });
      If(slot.has("normal"), () => {
        const world = normalize(sums.normal.xyz);
        layerDetail.assign(select(
          slot.triplanar,
          vec3(dot(world, frameTangent), dot(world, frameBitangent), dot(world, normal)),
          sums.normal.xyz
        ));
      });
      If(slot.has("orm"), () => {
        layerOrm.assign(sums.orm.rgb);
      });
    }
    function accumulateLayer(
      index: IntNode,
      weight: FloatNode
    ): void {
      const slot = slotMaterial(index);
      If(slot.present, () => {
        const layerAlbedo = vec3(kAlbedo).toVar();
        const layerDetail = vec3(0, 0, 1).toVar();
        const layerOrm = vec3(1, kDefaultRoughness, 0).toVar();
        If(slot.anyMap, () => sampleLayer(slot, layerAlbedo, layerDetail, layerOrm));
        albedo.addAssign(layerAlbedo.mul(weight));
        detail.addAssign(layerDetail.mul(weight));
        orm.addAssign(layerOrm.mul(weight));
        total.addAssign(weight);
      });
    }
    Loop(4, ({ i }) => {
      const weight = component(weights, i).toVar();
      If(weight.greaterThan(0), () => accumulateLayer(i, weight));
    });
    const painted = total.greaterThan(MIN_SPLAT_WEIGHT);
    const share = max(total, float(MIN_SPLAT_WEIGHT));

    return kSurface(
      select(painted, albedo.div(share), kAlbedo),
      select(painted, normalize(detail), vec3(0, 0, 1)),
      select(painted, orm.div(share), vec3(1, kDefaultRoughness, 0))
    );
  })();

  return {
    albedo: surface.get("albedo") as Vec3Node,
    detail: surface.get("detail") as Vec3Node,
    orm: surface.get("orm") as Vec3Node,
    materialArrays(arrays) {
      for (const map of MATERIAL_MAPS) {
        arrayNodes[map].value = arrays[map];
      }
    }
  };
}

function unchanged(
  sample: Vec4Node
): Vec4Node {
  return sample;
}

function uses(
  techniques: IntNode,
  technique: MaterialTechnique
): BoolNode {
  return techniques.bitAnd(int(MATERIAL_TECHNIQUE_BITS[technique])).notEqual(int(0));
}

function component(
  vector: Vec4Node,
  index: IntNode
): FloatNode {
  return select(
    index.equal(int(0)),
    vector.x,
    select(index.equal(int(1)), vector.y, select(index.equal(int(2)), vector.z, vector.w))
  );
}

function withComponent(
  vector: Vec4Node,
  index: IntNode,
  value: FloatNode
): Vec4Node {
  const mask = vec4From(
    SPLAT_CHANNEL_NAMES.map((_, channel) => select(index.equal(int(channel)), float(1), float(0)))
  );

  return mix(vector, vec4(value), mask);
}

function vec4From(
  [x, y, z, w]: FloatNode[]
): Vec4Node {
  return vec4(x, y, z, w);
}

function unpackNormal(
  sample: Vec4Node
): Vec3Node {
  return sample.rgb.mul(2).sub(1);
}
