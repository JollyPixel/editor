// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import type { PeerMetadata } from "#src/index.ts";

export const hostileKey = fc.oneof(
  fc.constantFrom("__proto__", "constructor", "prototype", "toString"),
  fc.string({ maxLength: 4 })
);

export function objectOf<T>(
  value: fc.Arbitrary<T>
): fc.Arbitrary<Record<string, T>> {
  return fc
    .array(fc.tuple(hostileKey, value), { maxLength: 3 })
    .map((entries) => Object.fromEntries(entries));
}

export const jsonPayload: fc.Arbitrary<unknown> = fc.letrec((tie) => {
  return {
    value: fc.oneof(
      { depthSize: "small" },
      fc.jsonValue({ maxDepth: 0 }),
      fc.array(tie("value"), { maxLength: 3 }),
      objectOf(tie("value"))
    )
  };
}).value;

export const metadata: fc.Arbitrary<PeerMetadata> = objectOf(jsonPayload);

function isPrototypeCarrier(
  key: string,
  value: unknown
): boolean {
  return key === "constructor" &&
    typeof value === "object" &&
    value !== null &&
    Object.hasOwn(value, "prototype");
}

export function wireCopy<T>(
  value: T
): T {
  return JSON.parse(
    JSON.stringify(value),
    (key, nested) => (key === "__proto__" || isPrototypeCarrier(key, nested) ? undefined : nested)
  );
}
