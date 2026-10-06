export class TopRanked<T> {
  readonly limit: number;

  #items: T[] = [];
  #compare: (left: T, right: T) => number;

  constructor(
    limit: number,
    compare: (left: T, right: T) => number
  ) {
    this.limit = limit;
    this.#compare = compare;
  }

  get size(): number {
    return this.#items.length;
  }

  add(
    item: T
  ): void {
    const items = this.#items;
    if (items.length < this.limit) {
      items.push(item);
      this.#siftUp(items.length - 1);
    }
    else if (items.length > 0 && this.#compare(item, items[0]) < 0) {
      items[0] = item;
      this.#siftDown(0);
    }
  }

  sorted(): T[] {
    return this.#items.slice().sort(this.#compare);
  }

  #siftUp(
    from: number
  ): void {
    const items = this.#items;
    const item = items[from];
    let index = from;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.#compare(item, items[parent]) <= 0) {
        break;
      }
      items[index] = items[parent];
      index = parent;
    }
    items[index] = item;
  }

  #siftDown(
    from: number
  ): void {
    const items = this.#items;
    const item = items[from];
    const half = items.length >> 1;
    let index = from;
    while (index < half) {
      let child = (index << 1) + 1;
      const right = child + 1;
      if (
        right < items.length &&
        this.#compare(items[right], items[child]) > 0
      ) {
        child = right;
      }
      if (this.#compare(item, items[child]) >= 0) {
        break;
      }
      items[index] = items[child];
      index = child;
    }
    items[index] = item;
  }
}
