// Import Internal Dependencies
import {
  defineSchema,
  type JSONSchema
} from "../protocol/schema.ts";

export type CommandVariantSchema<
  TAction extends string,
  TRequired extends Record<string, JSONSchema>,
  TOptional extends Record<string, JSONSchema>
> = {
  [keyword: string]: unknown;
  type: "object";
  properties: { action: { const: TAction; }; } & TRequired & TOptional;
  required: ("action" | Extract<keyof TRequired, string>)[];
};

export const commandHeaderProperties = {
  clientId: {
    type: "string"
  },
  seq: {
    type: "integer",
    minimum: 0
  },
  timestamp: {
    type: "number"
  },
  basis: {
    type: "integer",
    minimum: 0
  }
} as const;

export const COMMAND_HEADER_REQUIRED = [
  "clientId",
  "seq",
  "timestamp"
] as const;

export const networkCommandHeaderSchema = defineSchema({
  type: "object",
  properties: commandHeaderProperties,
  required: COMMAND_HEADER_REQUIRED
});

export function commandVariant<
  const TAction extends string,
  const TRequired extends Record<string, JSONSchema>,
  const TOptional extends Record<string, JSONSchema> = Record<never, never>
>(
  action: TAction,
  properties: TRequired,
  optionalProperties: TOptional = {} as TOptional
): CommandVariantSchema<TAction, TRequired, TOptional> {
  return {
    type: "object",
    properties: {
      action: { const: action },
      ...properties,
      ...optionalProperties
    },
    required: [
      "action",
      ...Object.keys(properties) as Extract<keyof TRequired, string>[]
    ]
  };
}

export function withCommandHeader(
  variant: JSONSchema
): JSONSchema {
  return {
    ...variant,
    properties: {
      ...commandHeaderProperties,
      ...variant.properties
    },
    required: [
      ...COMMAND_HEADER_REQUIRED,
      ...variant.required ?? []
    ]
  };
}
