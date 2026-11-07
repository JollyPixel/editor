export interface Round<T> {
  round: number;
  item: T;
}

export function* alternatingRounds<T>(
  items: readonly T[],
  rounds: number
): IterableIterator<Round<T>> {
  for (let round = 0; round < rounds; round++) {
    const order = round % 2 === 0 ? items : items.toReversed();
    for (const item of order) {
      yield { round, item };
    }
  }
}
