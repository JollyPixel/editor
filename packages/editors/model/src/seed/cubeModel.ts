// Import Internal Dependencies
import { glbFile } from "./glbFile.ts";

// CONSTANTS
const kFloat = 5126;
const kUnsignedShort = 5123;
const kFaces = [
  { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }
] as const;

type AccessorType = "SCALAR" | "VEC3" | "VEC4";

interface BufferEntry {
  data: Float32Array | Uint16Array;
  type: AccessorType;
  bounds?: boolean;
}

export function cubeModelGlb(): Uint8Array {
  const { positions, normals, indices } = cubeGeometry();
  const spinTimes = new Float32Array([0, 0.5, 1, 1.5, 2]);
  const spinRotations = new Float32Array(
    Array.from(spinTimes, (time) => {
      const half = time * Math.PI / 2;

      return [0, Math.sin(half), 0, Math.cos(half)];
    }).flat()
  );
  const bounceTimes = new Float32Array([0, 0.5, 1]);
  const bounceTranslations = new Float32Array([0, 0, 0, 0, 1, 0, 0, 0, 0]);

  const entries: BufferEntry[] = [
    { data: positions, type: "VEC3", bounds: true },
    { data: normals, type: "VEC3" },
    { data: indices, type: "SCALAR" },
    { data: spinTimes, type: "SCALAR", bounds: true },
    { data: spinRotations, type: "VEC4" },
    { data: bounceTimes, type: "SCALAR", bounds: true },
    { data: bounceTranslations, type: "VEC3" }
  ];
  const { bin, bufferViews, accessors } = packEntries(entries);

  return glbFile({
    asset: {
      version: "2.0",
      generator: "JollyPixel model editor seed"
    },
    buffers: [
      {
        byteLength: bin.byteLength
      }
    ],
    bufferViews,
    accessors,
    materials: [
      {
        name: "Orange",
        pbrMetallicRoughness: {
          baseColorFactor: [0.95, 0.55, 0.2, 1],
          metallicFactor: 0,
          roughnessFactor: 0.6
        }
      }
    ],
    meshes: [
      {
        name: "Cube",
        primitives: [
          {
            attributes: {
              POSITION: 0,
              NORMAL: 1
            },
            indices: 2,
            material: 0
          }
        ]
      }
    ],
    nodes: [
      {
        name: "Cube",
        mesh: 0
      }
    ],
    animations: [
      clip("spin", 3, 4, "rotation"),
      clip("bounce", 5, 6, "translation")
    ],
    scenes: [
      {
        nodes: [0]
      }
    ],
    scene: 0
  }, bin);
}

function cubeGeometry() {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (const { normal, u, v } of kFaces) {
    const base = positions.length / 3;
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let axis = 0; axis < 3; axis++) {
        const offset = (normal[axis] + su * u[axis] + sv * v[axis]) / 2;
        positions.push(axis === 1 ? offset + 0.5 : offset);
      }
      normals.push(...normal);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices)
  };
}

function packEntries(
  entries: BufferEntry[]
) {
  const length = entries.reduce(
    (total, { data }) => total + Math.ceil(data.byteLength / 4) * 4,
    0
  );
  const bin = new Uint8Array(length);
  const bufferViews: object[] = [];
  const accessors: object[] = [];

  let byteOffset = 0;
  for (const { data, type, bounds = false } of entries) {
    bin.set(new Uint8Array(data.buffer), byteOffset);
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: data.byteLength
    });
    const components = componentCount(type);
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: data instanceof Uint16Array ? kUnsignedShort : kFloat,
      count: data.length / components,
      type,
      ...(bounds ? accessorBounds(data, components) : {})
    });
    byteOffset += Math.ceil(data.byteLength / 4) * 4;
  }

  return { bin, bufferViews, accessors };
}

function accessorBounds(
  data: Float32Array | Uint16Array,
  components: number
) {
  const min = Array.from({ length: components }, () => Infinity);
  const max = Array.from({ length: components }, () => -Infinity);
  for (let index = 0; index < data.length; index++) {
    const component = index % components;
    min[component] = Math.min(min[component], data[index]);
    max[component] = Math.max(max[component], data[index]);
  }

  return { min, max };
}

function componentCount(
  type: AccessorType
): number {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC3":
      return 3;
    default:
      return 4;
  }
}

function clip(
  name: string,
  input: number,
  output: number,
  path: "rotation" | "translation"
) {
  return {
    name,
    channels: [
      {
        sampler: 0,
        target: {
          node: 0,
          path
        }
      }
    ],
    samplers: [
      {
        input,
        output
      }
    ]
  };
}
