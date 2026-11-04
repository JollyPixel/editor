// Import Node.js Dependencies
import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";

// CONSTANTS
const kPngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

type Vector3 = [number, number, number];

export interface CsNodeSpec {
  id: number;
  parentId?: number;
  name?: string;
  position?: Vector3;
  offset?: Vector3;
  stretch?: Vector3;
  orientation?: [number, number, number, number];
  size?: Vector3;
  faces?: [number, number][];
  flags?: number[];
}

export interface CsModelSpec {
  version?: number;
  nodes: CsNodeSpec[];
  texture?: Uint8Array;
}

export function transparentPng(
  width: number,
  height: number
): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return new Uint8Array(Buffer.concat([
    kPngSignature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.alloc(((width * 4) + 1) * height))),
    pngChunk("IEND", Buffer.alloc(0))
  ]));
}

export function csModelBytes(
  spec: CsModelSpec
): Uint8Array {
  const { version = 5, nodes, texture = transparentPng(64, 32) } = spec;
  const head = Buffer.alloc(7);
  head.writeUInt8(0, 0);
  head.writeUInt16LE(version, 1);
  head.writeUInt16LE(nodes.length + 1, 3);
  head.writeUInt16LE(nodes.length, 5);
  const length = Buffer.alloc(4);
  length.writeInt32LE(texture.byteLength);

  return new Uint8Array(Buffer.concat([
    head,
    ...nodes.map(nodeBytes),
    length,
    texture,
    Buffer.alloc(2)
  ]));
}

function nodeBytes(
  node: CsNodeSpec
): Buffer {
  const name = Buffer.from(node.name ?? `node ${node.id}`, "utf8");
  const ids = Buffer.alloc(4);
  ids.writeUInt16LE(node.id, 0);
  ids.writeInt16LE(node.parentId ?? -1, 2);
  const floats = Buffer.alloc(13 * 4);
  [
    ...node.position ?? [0, 0, 0],
    ...node.offset ?? [0, 0, 0],
    ...node.stretch ?? [1, 1, 1],
    ...node.orientation ?? [1, 0, 0, 0]
  ].forEach((value, index) => floats.writeFloatLE(value, index * 4));
  const size = Buffer.alloc(7);
  (node.size ?? [16, 16, 16]).forEach((value, index) => size.writeUInt16LE(value, index * 2));
  const faces = Buffer.alloc(6 * 8);
  (node.faces ?? []).forEach(([x, y], index) => {
    faces.writeInt32LE(x, index * 8);
    faces.writeInt32LE(y, (index * 8) + 4);
  });
  const flags = Buffer.alloc(6);
  (node.flags ?? []).forEach((value, index) => flags.writeUInt8(value, index));

  return Buffer.concat([
    ids,
    Buffer.from([name.byteLength]),
    name,
    floats,
    size,
    faces,
    flags
  ]);
}

function pngChunk(
  type: string,
  data: Buffer
): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  return Buffer.concat([
    length,
    Buffer.from(type, "ascii"),
    data,
    Buffer.alloc(4)
  ]);
}
