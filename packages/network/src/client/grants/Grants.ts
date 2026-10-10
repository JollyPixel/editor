// Import Internal Dependencies
import type { Right } from "../../protocol/types.ts";

export interface RightsSource {
  can(
    event: string
  ): Right;
}

export class Grants<TCapability extends string> {
  readonly #granted: ReadonlySet<TCapability>;

  constructor(
    granted: Iterable<TCapability>
  ) {
    this.#granted = new Set(granted);

    Object.freeze(this);
  }

  get readOnly(): boolean {
    return this.#granted.size === 0;
  }

  has(
    capability: TCapability
  ): boolean {
    return this.#granted.has(capability);
  }

  equals(
    other: Grants<TCapability>
  ): boolean {
    return this.#granted.size === other.#granted.size &&
      [...this.#granted].every((capability) => other.#granted.has(capability));
  }
}

export class CapabilityTable<
  TEvent extends string,
  TCapability extends string
> {
  readonly full: Grants<TCapability>;
  readonly none = new Grants<TCapability>([]);
  readonly #capabilities: Readonly<Record<TEvent, TCapability>>;

  constructor(
    capabilities: Readonly<Record<TEvent, TCapability>>
  ) {
    this.#capabilities = { ...capabilities };
    this.full = new Grants(Object.values<TCapability>(capabilities));
  }

  governs(
    event: string
  ): event is TEvent {
    return Object.hasOwn(this.#capabilities, event);
  }

  grantsFor(
    source: RightsSource
  ): Grants<TCapability> {
    const withheld = new Set<TCapability>();
    for (const [event, capability] of Object.entries<TCapability>(this.#capabilities)) {
      if (source.can(event) !== "write") {
        withheld.add(capability);
      }
    }

    return new Grants(
      Object.values<TCapability>(this.#capabilities)
        .filter((capability) => !withheld.has(capability))
    );
  }
}
