// Import Third-party Dependencies
import type { ThreeComponentPackage } from "@jolly-pixel/backend.three";

export interface RuntimeContribution {
  readonly name: string;
  readonly module: {
    readonly RUNTIME_COMPONENTS?: ThreeComponentPackage;
  };
}

export type NamedRuntimePackage = readonly [
  name: string,
  components: ThreeComponentPackage
];

export function contributedRuntimePackages(
  contributions: Iterable<RuntimeContribution>
): NamedRuntimePackage[] {
  return Array.from(contributions, ({ name, module }) => {
    if (module.RUNTIME_COMPONENTS === undefined) {
      throw new TypeError(
        `"${name}" declares "jollypixel.runtime" but does not export "RUNTIME_COMPONENTS".`
      );
    }

    return [name, module.RUNTIME_COMPONENTS] as const;
  });
}
