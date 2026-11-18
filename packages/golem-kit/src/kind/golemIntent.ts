// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { IntentInputError } from "./errors/IntentInputError.ts";

export interface GolemIntent<TAsset> {
  readonly description: string;
  readonly input: z.core.$ZodType;
  run(asset: TAsset, input: unknown): Promise<unknown>;
}

export interface GolemIntentDefinition<
  TAsset,
  TInput extends z.core.$ZodType
> {
  description: string;
  input: TInput;
  run(asset: TAsset, input: z.output<TInput>): Promise<unknown>;
}

export function golemIntent<
  TAsset,
  TInput extends z.core.$ZodType
>(
  definition: GolemIntentDefinition<TAsset, TInput>
): GolemIntent<TAsset> {
  return {
    description: definition.description,
    input: definition.input,
    run: async(asset, input) => {
      const parsed = z.safeParse(definition.input, input);
      if (!parsed.success) {
        throw new IntentInputError(z.prettifyError(parsed.error));
      }

      return definition.run(asset, parsed.data);
    }
  };
}
