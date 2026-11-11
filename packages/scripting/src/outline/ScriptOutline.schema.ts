// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import * as z from "zod/mini";

// CONSTANTS
const kScalarSchema = z.union([z.number(), z.string(), z.boolean()]);

export const scriptPropertyValueSchema = z.union([
  kScalarSchema,
  z.array(kScalarSchema)
]);

export const scriptPropertySchema = z.object({
  key: z.string(),
  type: z.string(),
  label: z.string(),
  description: z.string(),
  default: z.nullable(scriptPropertyValueSchema)
});

export const scriptBehaviorSchema = z.object({
  name: z.string(),
  properties: z.array(scriptPropertySchema)
});

export const scriptOutlineSchema = z.object({
  behaviors: z.array(scriptBehaviorSchema)
});

export type ScriptPropertyValue = Infer<typeof scriptPropertyValueSchema>;
export type ScriptProperty = Infer<typeof scriptPropertySchema>;
export type ScriptBehavior = Infer<typeof scriptBehaviorSchema>;
export type ScriptOutline = Infer<typeof scriptOutlineSchema>;
