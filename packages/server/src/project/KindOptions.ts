// Import Third-party Dependencies
import * as z from "zod";

export const kindOptionsSchema = z.record(
  z.string(),
  z.record(z.string(), z.unknown())
);

export const kindOptionVector2Schema = z.object({
  x: z.number(),
  y: z.number()
});

const kKindOptionFieldShape = {
  path: z.array(z.string()),
  label: z.string(),
  min: z.number().optional(),
  max: z.number().optional()
};

export const kindOptionFieldSchema = z.discriminatedUnion("type", [
  z.object({
    ...kKindOptionFieldShape,
    type: z.literal("number"),
    default: z.number().optional()
  }),
  z.object({
    ...kKindOptionFieldShape,
    type: z.literal("vector2"),
    default: kindOptionVector2Schema
  })
]);

export const kindOptionGroupSchema = z.object({
  path: z.array(z.string()),
  label: z.string(),
  fields: z.array(kindOptionFieldSchema)
});

export const kindOptionSectionSchema = z.object({
  label: z.string().nullable(),
  fields: z.array(kindOptionFieldSchema),
  groups: z.array(kindOptionGroupSchema)
});

export type KindOptions = z.infer<typeof kindOptionsSchema>;
export type KindOptionField = z.infer<typeof kindOptionFieldSchema>;
export type KindOptionVector2 = z.infer<typeof kindOptionVector2Schema>;
export type KindOptionValue<
  TField extends KindOptionField = KindOptionField
> = TField extends { type: "vector2"; } ? KindOptionVector2 : number;
export type KindOptionGroup = z.infer<typeof kindOptionGroupSchema>;
export type KindOptionSection = z.infer<typeof kindOptionSectionSchema>;
