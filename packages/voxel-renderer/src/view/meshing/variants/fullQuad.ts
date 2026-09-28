export function isFullQuad(
  cull: number,
  positions: Float32Array,
  tileUvs: Float32Array
): boolean {
  if (positions.length !== 12 || cull < 0) {
    return false;
  }

  // FACE packs direction as `axis * 2 + (negative ? 1 : 0)`.
  const axis = cull >> 1;
  const plane = (cull & 1) === 0 ? 1 : 0;
  const uAxis = axis === 0 ? 1 : 0;
  const vAxis = axis === 2 ? 1 : 2;

  /*
   * Bit `(v << 1) | u` per visited corner; all four must show up exactly once
   * in both position and tile space.
   */
  let cornerMask = 0;
  let uvMask = 0;

  for (let i = 0; i < 4; i++) {
    if (positions[(i * 3) + axis] !== plane) {
      return false;
    }

    const pu = positions[(i * 3) + uAxis];
    const pv = positions[(i * 3) + vAxis];
    const tu = tileUvs[i * 2];
    const tv = tileUvs[(i * 2) + 1];
    if (!isCorner(pu) || !isCorner(pv) || !isCorner(tu) || !isCorner(tv)) {
      return false;
    }

    cornerMask |= 1 << ((pv << 1) | pu);
    uvMask |= 1 << ((tv << 1) | tu);
  }

  return cornerMask === 0b1111 && uvMask === 0b1111;
}

function isCorner(
  value: number
): boolean {
  return value === 0 || value === 1;
}
