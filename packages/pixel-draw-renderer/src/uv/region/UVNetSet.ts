// Import Internal Dependencies
import {
  SavedUVNet,
  type SavedUVNetData
} from "./SavedUVNet.ts";

export interface UVNetSetData {
  defaultId?: string;
  nets: SavedUVNetData[];
}

export class UVNetSet implements Iterable<SavedUVNet> {
  static readonly empty = new UVNetSet([], null);

  static from(
    data: UVNetSetData
  ): UVNetSet {
    const set = UVNetSet.parse(data);
    if (set === null) {
      throw new TypeError("A UV net set requires unique, valid nets");
    }

    return set;
  }

  static parse(
    value: unknown
  ): UVNetSet | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }

    const defaultId: unknown = Reflect.get(value, "defaultId");
    const nets: unknown = Reflect.get(value, "nets");
    if (
      (defaultId !== undefined && !isNetId(defaultId)) ||
      !Array.isArray(nets)
    ) {
      return null;
    }

    const parsed: SavedUVNet[] = [];
    for (const entry of nets) {
      const net = SavedUVNet.parse(entry);
      if (net === null || parsed.some((saved) => saved.id === net.id)) {
        return null;
      }
      parsed.push(net);
    }

    return new UVNetSet(parsed, defaultId ?? null);
  }

  readonly defaultId: string | null;
  readonly #nets: readonly SavedUVNet[];

  private constructor(
    nets: readonly SavedUVNet[],
    defaultId: string | null
  ) {
    this.#nets = nets;
    this.defaultId = defaultId;
  }

  * [Symbol.iterator](): IterableIterator<SavedUVNet> {
    yield* this.#nets;
  }

  get isEmpty(): boolean {
    return this.#nets.length === 0 && this.defaultId === null;
  }

  get(
    id: string
  ): SavedUVNet | undefined {
    return this.#nets.find((saved) => saved.id === id);
  }

  with(
    saved: SavedUVNet
  ): UVNetSet {
    const index = this.#nets.findIndex((net) => net.id === saved.id);
    if (index === -1) {
      return new UVNetSet([...this.#nets, saved], this.defaultId);
    }
    if (this.#nets[index].equals(saved)) {
      return this;
    }

    return new UVNetSet(this.#nets.with(index, saved), this.defaultId);
  }

  without(
    id: string
  ): UVNetSet {
    const nets = this.#nets.filter((saved) => saved.id !== id);

    return nets.length === this.#nets.length ?
      this :
      new UVNetSet(nets, this.defaultId);
  }

  withDefault(
    id: string | null
  ): UVNetSet {
    return id === this.defaultId ? this : new UVNetSet(this.#nets, id);
  }

  toJSON(): UVNetSetData {
    const nets = this.#nets.map((saved) => saved.toJSON());

    return this.defaultId === null ?
      { nets } :
      {
        defaultId: this.defaultId,
        nets
      };
  }
}

function isNetId(
  value: unknown
): value is string {
  return typeof value === "string" && value.length > 0;
}
