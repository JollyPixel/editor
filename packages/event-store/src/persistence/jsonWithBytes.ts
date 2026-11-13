// CONSTANTS
const kBytesKey = "$bytes";
const kBytesMarker = `"${kBytesKey}"`;

export interface JsonWithBytes {
  readonly json: string;
  readonly bytes: Uint8Array | null;
}

export function encodeJsonWithBytes(
  value: unknown,
  field: string
): JsonWithBytes {
  const attached: Uint8Array[] = [];
  let length = 0;
  const json = stringify(value, field, (bytes) => {
    attached.push(bytes);
    const range = [length, bytes.byteLength];
    length += bytes.byteLength;

    return range;
  });

  return {
    json,
    bytes: packBytes(attached, length)
  };
}

export function encodeJson(
  value: unknown,
  field: string
): string {
  return stringify(value, field, () => {
    throw new TypeError(
      `${field} must not hold a Uint8Array`
    );
  });
}

export function decodeJsonWithBytes(
  encoded: JsonWithBytes
): unknown {
  const { json, bytes } = encoded;
  if (!json.includes(kBytesMarker)) {
    return JSON.parse(json);
  }

  return JSON.parse(json, (_key, value: unknown) => {
    if (
      !isObject(value) ||
      !Object.hasOwn(value, kBytesKey) ||
      Object.keys(value).length !== 1
    ) {
      return value;
    }

    return sliceBytes(value[kBytesKey], bytes);
  });
}

function stringify(
  value: unknown,
  field: string,
  placeBytes: (bytes: Uint8Array) => unknown
): string {
  const json = JSON.stringify(value, function replaceBytes(key, replaced) {
    const original: unknown = (this as Record<string, unknown>)[key];
    if (original instanceof Uint8Array) {
      return {
        [kBytesKey]: placeBytes(original)
      };
    }
    if (isObject(replaced) && Object.hasOwn(replaced, kBytesKey)) {
      throw new TypeError(
        `${field} must not hold the reserved key "${kBytesKey}"`
      );
    }

    return replaced;
  });
  if (json === undefined) {
    throw new TypeError(
      `${field} must be JSON-serializable`
    );
  }

  return json;
}

function packBytes(
  attached: readonly Uint8Array[],
  length: number
): Uint8Array | null {
  if (attached.length === 0) {
    return null;
  }

  const packed = new Uint8Array(length);
  let offset = 0;
  for (const bytes of attached) {
    packed.set(bytes, offset);
    offset += bytes.byteLength;
  }

  return packed;
}

function sliceBytes(
  range: unknown,
  bytes: Uint8Array | null
): Uint8Array {
  const [start, length]: unknown[] = Array.isArray(range) &&
    range.length === 2 ? range : [];
  if (
    bytes === null ||
    typeof start !== "number" ||
    typeof length !== "number" ||
    !Number.isInteger(start) ||
    !Number.isInteger(length) ||
    start < 0 ||
    length < 0 ||
    start + length > bytes.byteLength
  ) {
    throw new RangeError(
      `${kBytesKey} ${JSON.stringify(range)} is outside the stored event bytes`
    );
  }

  return bytes.slice(start, start + length);
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value);
}
