// CONSTANTS
const kGlbMagic = 0x46546C67;
const kJsonChunk = 0x4E4F534A;
const kBinChunk = 0x004E4942;

export function glbFile(
  json: object,
  bin: Uint8Array
): Uint8Array {
  const jsonBytes = padded(
    new TextEncoder().encode(JSON.stringify(json)),
    0x20
  );
  const binBytes = padded(bin, 0);
  const length = 12 + 8 + jsonBytes.byteLength + 8 + binBytes.byteLength;

  const file = new Uint8Array(length);
  const view = new DataView(file.buffer);
  view.setUint32(0, kGlbMagic, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, length, true);
  view.setUint32(12, jsonBytes.byteLength, true);
  view.setUint32(16, kJsonChunk, true);
  file.set(jsonBytes, 20);
  const binOffset = 20 + jsonBytes.byteLength;
  view.setUint32(binOffset, binBytes.byteLength, true);
  view.setUint32(binOffset + 4, kBinChunk, true);
  file.set(binBytes, binOffset + 8);

  return file;
}

export function spinningTriangleGlb(): Uint8Array {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const times = new Float32Array([0, 1]);
  const half = Math.SQRT1_2;
  const rotations = new Float32Array([0, 0, 0, 1, 0, half, 0, half]);
  const bin = new Uint8Array(
    positions.byteLength + times.byteLength + rotations.byteLength
  );
  bin.set(new Uint8Array(positions.buffer), 0);
  bin.set(new Uint8Array(times.buffer), positions.byteLength);
  bin.set(
    new Uint8Array(rotations.buffer),
    positions.byteLength + times.byteLength
  );

  return glbFile({
    asset: {
      version: "2.0"
    },
    buffers: [
      {
        byteLength: bin.byteLength
      }
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: positions.byteLength
      },
      {
        buffer: 0,
        byteOffset: positions.byteLength,
        byteLength: times.byteLength
      },
      {
        buffer: 0,
        byteOffset: positions.byteLength + times.byteLength,
        byteLength: rotations.byteLength
      }
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0]
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: 2,
        type: "SCALAR",
        min: [0],
        max: [1]
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: 2,
        type: "VEC4"
      }
    ],
    meshes: [
      {
        primitives: [
          {
            attributes: {
              POSITION: 0
            }
          }
        ]
      }
    ],
    nodes: [
      {
        name: "triangle",
        mesh: 0
      }
    ],
    animations: [
      {
        name: "spin",
        channels: [
          {
            sampler: 0,
            target: {
              node: 0,
              path: "rotation"
            }
          }
        ],
        samplers: [
          {
            input: 1,
            output: 2
          }
        ]
      }
    ],
    scenes: [
      {
        nodes: [0]
      }
    ],
    scene: 0
  }, bin);
}

function padded(
  bytes: Uint8Array,
  fill: number
): Uint8Array {
  const length = Math.ceil(bytes.byteLength / 4) * 4;
  const result = new Uint8Array(length).fill(fill);
  result.set(bytes);

  return result;
}
