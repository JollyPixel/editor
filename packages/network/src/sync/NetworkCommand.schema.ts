// Import Third-party Dependencies
import * as z from "zod/mini";

// CONSTANTS
const kSequence = z.int().check(z.minimum(0));

export const commandHeaderShape = {
  clientId: z.string(),
  seq: kSequence,
  timestamp: z.number(),
  basis: z.optional(kSequence)
};

export const networkCommandHeaderSchema = z.object(commandHeaderShape);

export function commandVariant<
  const TAction extends string,
  const TShape extends z.core.$ZodLooseShape = Record<never, never>
>(
  action: TAction,
  shape: TShape = {} as TShape
) {
  return z.object({
    action: z.literal(action),
    ...shape
  });
}

export function withCommandHeader<
  TVariant extends z.ZodMiniObject
>(
  variant: TVariant
) {
  return z.extend(variant, commandHeaderShape);
}
