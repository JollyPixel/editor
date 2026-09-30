// Ported from fastest-levenshtein, MIT, Copyright (c) 2020 Kasper Unn Weihe

// CONSTANTS
const kPeq = new Uint32Array(0x10000);

export function distance(
  left: string,
  right: string
): number {
  const [long, short] = left.length < right.length ?
    [right, left] :
    [left, right];
  if (short.length === 0) {
    return long.length;
  }
  if (long.length <= 32) {
    return myers32(long, short, 0, short.length, short.length);
  }

  return myersX(long, short);
}

export function prefixDistance(
  pattern: string,
  text: string,
  start: number,
  shortest: number,
  longest: number
): number {
  if (pattern.length === 0) {
    return shortest;
  }
  if (pattern.length <= 32) {
    return myers32(pattern, text, start, shortest, longest);
  }

  let best = Infinity;
  for (let length = shortest; length <= longest; length++) {
    const prefix = text.slice(start, start + length);
    best = Math.min(best, distance(pattern, prefix));
  }

  return best;
}

function myers32(
  a: string,
  b: string,
  start: number,
  shortest: number,
  longest: number
): number {
  const n = a.length;
  const lst = 1 << (n - 1);
  let pv = -1;
  let mv = 0;
  let sc = n;
  let best = shortest === 0 ? sc : Infinity;
  let i = n;
  while (i--) {
    kPeq[a.charCodeAt(i)] |= 1 << i;
  }
  for (i = 0; i < longest; i++) {
    let eq = kPeq[b.charCodeAt(start + i)];
    const xv = eq | mv;
    eq |= ((eq & pv) + pv) ^ pv;
    mv |= ~(eq | pv);
    pv &= eq;
    if (mv & lst) {
      sc++;
    }
    if (pv & lst) {
      sc--;
    }
    mv = (mv << 1) | 1;
    pv = (pv << 1) | ~(xv | mv);
    mv &= xv;
    if (i + 1 >= shortest && sc < best) {
      best = sc;
    }
  }
  i = n;
  while (i--) {
    kPeq[a.charCodeAt(i)] = 0;
  }

  return best;
}

function myersX(
  b: string,
  a: string
): number {
  const n = a.length;
  const m = b.length;
  const mhc: number[] = [];
  const phc: number[] = [];
  const hsize = Math.ceil(n / 32);
  const vsize = Math.ceil(m / 32);
  for (let i = 0; i < hsize; i++) {
    phc[i] = -1;
    mhc[i] = 0;
  }
  let j = 0;
  for (; j < vsize - 1; j++) {
    let mv = 0;
    let pv = -1;
    const start = j * 32;
    const vlen = Math.min(32, m) + start;
    for (let k = start; k < vlen; k++) {
      kPeq[b.charCodeAt(k)] |= 1 << k;
    }
    for (let i = 0; i < n; i++) {
      const eq = kPeq[a.charCodeAt(i)];
      const pb = (phc[(i / 32) | 0] >>> i) & 1;
      const mb = (mhc[(i / 32) | 0] >>> i) & 1;
      const xv = eq | mv;
      const xh = ((((eq | mb) & pv) + pv) ^ pv) | eq | mb;
      let ph = mv | ~(xh | pv);
      let mh = pv & xh;
      if ((ph >>> 31) ^ pb) {
        phc[(i / 32) | 0] ^= 1 << i;
      }
      if ((mh >>> 31) ^ mb) {
        mhc[(i / 32) | 0] ^= 1 << i;
      }
      ph = (ph << 1) | pb;
      mh = (mh << 1) | mb;
      pv = mh | ~(xv | ph);
      mv = ph & xv;
    }
    for (let k = start; k < vlen; k++) {
      kPeq[b.charCodeAt(k)] = 0;
    }
  }
  let mv = 0;
  let pv = -1;
  const start = j * 32;
  const vlen = Math.min(32, m - start) + start;
  for (let k = start; k < vlen; k++) {
    kPeq[b.charCodeAt(k)] |= 1 << k;
  }
  let score = m;
  for (let i = 0; i < n; i++) {
    const eq = kPeq[a.charCodeAt(i)];
    const pb = (phc[(i / 32) | 0] >>> i) & 1;
    const mb = (mhc[(i / 32) | 0] >>> i) & 1;
    const xv = eq | mv;
    const xh = ((((eq | mb) & pv) + pv) ^ pv) | eq | mb;
    let ph = mv | ~(xh | pv);
    let mh = pv & xh;
    score += (ph >>> (m - 1)) & 1;
    score -= (mh >>> (m - 1)) & 1;
    if ((ph >>> 31) ^ pb) {
      phc[(i / 32) | 0] ^= 1 << i;
    }
    if ((mh >>> 31) ^ mb) {
      mhc[(i / 32) | 0] ^= 1 << i;
    }
    ph = (ph << 1) | pb;
    mh = (mh << 1) | mb;
    pv = mh | ~(xv | ph);
    mv = ph & xv;
  }
  for (let k = start; k < vlen; k++) {
    kPeq[b.charCodeAt(k)] = 0;
  }

  return score;
}
