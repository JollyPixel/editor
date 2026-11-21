// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { ComponentSlotError } from "./errors/ComponentSlotError.ts";
import { UnknownComponentError } from "./errors/UnknownComponentError.ts";

// CONSTANTS
const kDeclarationSchema = z.object({
  type: z.string(),
  assets: z.record(z.string(), z.string())
});
const kKindPackagesSchema = z.array(z.object({
  sceneComponents: z.array(kDeclarationSchema)
}));

export type SceneComponentDeclaration = z.output<typeof kDeclarationSchema>;

export type ComponentAssets = Readonly<Record<
  string,
  { readonly kind: string; } | null
>>;

export class SceneComponentTypes {
  static parse(
    kindPackages: readonly unknown[]
  ): SceneComponentTypes {
    return new SceneComponentTypes(
      z.parse(kKindPackagesSchema, kindPackages)
        .flatMap((kindPackage) => kindPackage.sceneComponents)
    );
  }

  #slots: ReadonlyMap<string, Readonly<Record<string, string>>>;

  constructor(
    declarations: Iterable<SceneComponentDeclaration>
  ) {
    this.#slots = new Map(Array.from(
      declarations,
      ({ type, assets }) => [type, assets]
    ));
  }

  assertValid(
    type: string,
    assets: ComponentAssets
  ): void {
    const slots = this.#slots.get(type);
    if (slots === undefined) {
      throw new UnknownComponentError(type, [...this.#slots.keys()]);
    }

    for (const [slot, reference] of Object.entries(assets)) {
      const kind = Object.hasOwn(slots, slot) ? slots[slot] : undefined;
      if (kind === undefined) {
        const names = Object.keys(slots);

        throw new ComponentSlotError(
          type,
          slot,
          `does not exist; its slots: ${names.join(", ") || "none"}`
        );
      }
      if (reference !== null && reference.kind !== kind) {
        throw new ComponentSlotError(
          type,
          slot,
          `takes a "${kind}" asset, not a "${reference.kind}"`
        );
      }
    }
  }
}
