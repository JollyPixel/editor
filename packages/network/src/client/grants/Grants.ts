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

export interface CapabilityDeclaration<
  TCapability extends string = string,
  TEvent extends string = string
> {
  readonly name: TCapability;
  readonly label: string;
  readonly events: readonly TEvent[];
}

export type CapabilityName<
  TDeclarations extends readonly CapabilityDeclaration[]
> = TDeclarations[number]["name"];

export type UncoveredEvents<
  TEvent extends string,
  TDeclarations extends readonly CapabilityDeclaration[]
> = Exclude<TEvent, TDeclarations[number]["events"][number]>;

export function defineCapabilities<TEvent extends string>() {
  return <
    const TDeclarations extends readonly CapabilityDeclaration<string, TEvent>[]
  >(
    declarations: TDeclarations,
    ..._uncovered: [UncoveredEvents<TEvent, TDeclarations>] extends [never] ?
      [] :
      [uncovered: UncoveredEvents<TEvent, TDeclarations>]
  ): TDeclarations => declarations;
}

export class CapabilityTable<
  TEvent extends string,
  TCapability extends string
> {
  readonly full: Grants<TCapability>;
  readonly none = new Grants<TCapability>([]);
  readonly #capabilities: ReadonlyMap<string, TCapability>;

  constructor(
    declarations: Iterable<CapabilityDeclaration<TCapability, TEvent>>
  ) {
    const capabilities = new Map<string, TCapability>();
    for (const { name, events } of declarations) {
      for (const event of events) {
        const owner = capabilities.get(event);
        if (owner !== undefined) {
          throw new TypeError(
            `Event "${event}" belongs to both "${owner}" and "${name}".`
          );
        }
        capabilities.set(event, name);
      }
    }
    this.#capabilities = capabilities;
    this.full = new Grants(capabilities.values());
  }

  governs(
    event: string
  ): event is TEvent {
    return this.#capabilities.has(event);
  }

  resolveGrants(
    source: RightsSource
  ): Grants<TCapability> {
    const withheld = new Set<TCapability>();
    for (const [event, capability] of this.#capabilities) {
      if (source.can(event) !== "write") {
        withheld.add(capability);
      }
    }

    return new Grants(
      [...this.#capabilities.values()]
        .filter((capability) => !withheld.has(capability))
    );
  }
}
