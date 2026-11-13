// Import Internal Dependencies
import { InvalidCsModelError } from "./errors/InvalidCsModelError.ts";

// CONSTANTS
export const CSMODEL_VERSION = 5;
const kFaceCount = 6;
const kNoParent = -1;
const kAssetTypeBytes = 1;
const kNextNodeIdBytes = 2;
const kUnwrapModeBytes = 1;
const kQuarterTurnFlags = [[1, 1], [2, 2], [4, 3]] as const;
const kMirrorHorizontal = 8;
const kMirrorVertical = 16;

export interface CsVector3 {
  x: number;
  y: number;
  z: number;
}

export interface CsQuaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

export interface CsFaceOrientation {
  clockwiseTurns: number;
  mirroredHorizontally: boolean;
  mirroredVertically: boolean;
}

export interface CsFace {
  x: number;
  y: number;
  orientation: CsFaceOrientation;
}

export interface CsModelNode {
  id: number;
  parentId: number | null;
  name: string;
  position: CsVector3;
  offset: CsVector3;
  stretch: CsVector3;
  orientation: CsQuaternion;
  size: CsVector3;
  faces: CsFace[];
}

export interface CsModel {
  nodes: CsModelNode[];
  texture: Uint8Array;
}

class ByteCursor {
  #view: DataView;
  #bytes: Uint8Array;
  #offset = 0;
  #text = new TextDecoder("utf-8", { fatal: true });

  constructor(
    bytes: Uint8Array
  ) {
    this.#bytes = bytes;
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  u8(): number {
    return this.#view.getUint8(this.#advance(1));
  }

  u16(): number {
    return this.#view.getUint16(this.#advance(2), true);
  }

  i16(): number {
    return this.#view.getInt16(this.#advance(2), true);
  }

  i32(): number {
    return this.#view.getInt32(this.#advance(4), true);
  }

  f32(): number {
    return this.#view.getFloat32(this.#advance(4), true);
  }

  vector3(
    read: () => number
  ): CsVector3 {
    return {
      x: read(),
      y: read(),
      z: read()
    };
  }

  bytes(
    length: number
  ): Uint8Array {
    if (length < 0) {
      throw new RangeError("negative length");
    }
    const start = this.#advance(length);

    return this.#bytes.slice(start, start + length);
  }

  string(): string {
    return this.#text.decode(this.bytes(this.u8()));
  }

  skip(
    length: number
  ): void {
    this.#advance(length);
  }

  #advance(
    length: number
  ): number {
    const start = this.#offset;
    if (start + length > this.#bytes.byteLength) {
      throw new RangeError("unexpected end of data");
    }
    this.#offset += length;

    return start;
  }
}

export function readCsModel(
  content: Uint8Array
): CsModel {
  const cursor = new ByteCursor(content);
  try {
    cursor.skip(kAssetTypeBytes);
    const version = cursor.u16();
    if (version !== CSMODEL_VERSION) {
      throw new InvalidCsModelError(`version ${version} is not supported`);
    }
    cursor.skip(kNextNodeIdBytes);

    const nodes = Array.from(
      { length: cursor.u16() },
      () => readNode(cursor)
    );

    return {
      nodes,
      texture: cursor.bytes(cursor.i32())
    };
  }
  catch (error) {
    if (error instanceof InvalidCsModelError) {
      throw error;
    }

    throw new InvalidCsModelError("the data is truncated or malformed", {
      cause: error
    });
  }
}

function readNode(
  cursor: ByteCursor
): CsModelNode {
  const id = cursor.u16();
  const parentId = cursor.i16();
  const name = cursor.string();
  const position = cursor.vector3(() => cursor.f32());
  const offset = cursor.vector3(() => cursor.f32());
  const stretch = cursor.vector3(() => cursor.f32());
  const orientation = {
    w: cursor.f32(),
    x: cursor.f32(),
    y: cursor.f32(),
    z: cursor.f32()
  };
  const size = cursor.vector3(() => cursor.u16());
  cursor.skip(kUnwrapModeBytes);
  const offsets = Array.from(
    { length: kFaceCount },
    () => [cursor.i32(), cursor.i32()]
  );
  const faces = offsets.map(([x, y]) => {
    return {
      x,
      y,
      orientation: decodeOrientation(cursor.u8())
    };
  });

  return {
    id,
    parentId: parentId === kNoParent ? null : parentId,
    name,
    position,
    offset,
    stretch,
    orientation,
    size,
    faces
  };
}

function decodeOrientation(
  flags: number
): CsFaceOrientation {
  const turn = kQuarterTurnFlags.find(([bit]) => (flags & bit) !== 0);

  return {
    clockwiseTurns: turn === undefined ? 0 : turn[1],
    mirroredHorizontally: (flags & kMirrorHorizontal) !== 0,
    mirroredVertically: (flags & kMirrorVertical) !== 0
  };
}
