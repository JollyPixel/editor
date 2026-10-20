export type Random = () => number;

export function seededRandom(
  seed: number
): Random {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
}

export function randomInteger(
  random: Random,
  min: number,
  max: number
): number {
  return min + Math.floor(random() * (max - min + 1));
}
