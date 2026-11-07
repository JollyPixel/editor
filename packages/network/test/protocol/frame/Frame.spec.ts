// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodeFrame,
  encodedLength,
  encodeFrame,
  type FrameDecodeError
} from "#src/protocol/frame/Frame.ts";

// CONSTANTS
const kUtf8 = new TextEncoder();

function encode(
  value: unknown
): Uint8Array<ArrayBuffer> {
  const frame = encodeFrame(value);
  assert.ok(frame instanceof Uint8Array);

  return frame;
}

function decode(
  frame: string | Uint8Array | ArrayBuffer
): unknown {
  const result = decodeFrame(frame);
  assert.ok(result.ok, result.ok ? "" : result.val.message);

  return result.val;
}

function decodeError(
  frame: string | Uint8Array
): FrameDecodeError {
  const result = decodeFrame(frame);
  assert.ok(!result.ok);

  return result.val;
}

function handBuiltFrame(
  header: string | Uint8Array,
  attachments: readonly Uint8Array[] = [],
  version = 1
): Uint8Array {
  const headerBytes = typeof header === "string" ? kUtf8.encode(header) : header;
  const parts: number[] = [version];
  const lengths = attachments.map((item) => item.byteLength);
  for (const value of [headerBytes.byteLength, attachments.length, ...lengths]) {
    parts.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, value >>> 24);
  }
  parts.push(...headerBytes);
  for (const attachment of attachments) {
    while (parts.length % 8 !== 0) {
      parts.push(0);
    }
    parts.push(...attachment);
  }

  return Uint8Array.from(parts);
}

describe("encodeFrame", () => {
  test("a value without bytes is a JSON text frame", () => {
    assert.equal(encodeFrame({ room: "a", kind: "leave" }), "{\"room\":\"a\",\"kind\":\"leave\"}");
  });

  test("a value with bytes follows the documented binary layout", () => {
    const value = {
      first: Uint8Array.of(1, 2, 3),
      list: [Uint8Array.of(), Uint8Array.of(9)]
    };

    assert.deepEqual(
      encode(value),
      handBuiltFrame(
        "{\"first\":{\"$bytes\":0},\"list\":[{\"$bytes\":1},{\"$bytes\":2}]}",
        [Uint8Array.of(1, 2, 3), Uint8Array.of(), Uint8Array.of(9)]
      )
    );
  });

  test("a Node Buffer is sent as bytes, not through its toJSON", () => {
    const decoded = decode(encode({ data: Buffer.from([4, 5]) }));

    assert.deepEqual(decoded, { data: Uint8Array.of(4, 5) });
  });

  test("refuses an object whose only key is the placeholder key", () => {
    assert.throws(
      () => encodeFrame({ payload: { $bytes: 0 } }),
      { name: "PlaceholderCollisionError" }
    );
  });
});

describe("decodeFrame", () => {
  test("bytes read back as Uint8Array views at any depth", () => {
    const value = {
      room: "model",
      payload: {
        snapshot: Uint8Array.from({ length: 1_000 }, (_, index) => index % 251),
        parts: [Uint8Array.of(7), { nested: Uint8Array.of() }]
      }
    };

    assert.deepEqual(decode(encode(value)), value);
  });

  test("each attachment starts on an 8-byte boundary of the frame", () => {
    const frame = encode({ a: Uint8Array.of(1), b: Uint8Array.of(2, 3, 4), c: Uint8Array.of(5) });
    const decoded = decode(frame.buffer) as Record<string, Uint8Array>;

    for (const bytes of Object.values(decoded)) {
      assert.equal(bytes.buffer, frame.buffer);
      assert.equal(bytes.byteOffset % 8, 0);
    }
  });

  test("a frame received as a Node Buffer decodes to plain Uint8Array views", () => {
    const frame = Buffer.from(encode({ data: Uint8Array.of(1) }));
    const decoded = decode(frame) as { data: Uint8Array; };

    assert.equal(Buffer.isBuffer(decoded.data), false);
    assert.deepEqual(decoded.data, Uint8Array.of(1));
  });

  test("an object with more keys than the placeholder key stays an object", () => {
    const frame = handBuiltFrame(
      JSON.stringify({
        a: { $bytes: 0 },
        b: { $bytes: 0, extra: true }
      }),
      [Uint8Array.of(1)]
    );

    assert.deepEqual(decode(frame), {
      a: Uint8Array.of(1),
      b: { $bytes: 0, extra: true }
    });
  });

  const kValid = handBuiltFrame("{\"a\":{\"$bytes\":0}}", [Uint8Array.of(1, 2)]);
  const kMalformed: [string, string | Uint8Array][] = [
    ["a frame shorter than its prefix", Uint8Array.of(1, 0, 0)],
    ["an unknown version", handBuiltFrame("{}", [], 2)],
    ["a header that overruns the frame", kValid.subarray(0, 20)],
    ["an attachment that overruns the frame", kValid.subarray(0, kValid.byteLength - 1)],
    ["bytes after the last attachment", Uint8Array.from([...kValid, 0])],
    ["a header that is not UTF-8", handBuiltFrame(Uint8Array.of(0xff))],
    ["a placeholder past the last attachment", handBuiltFrame("[{\"$bytes\":1}]", [Uint8Array.of(1)])],
    ["a negative placeholder", handBuiltFrame("[{\"$bytes\":-1}]", [Uint8Array.of(1)])],
    ["a string placeholder", handBuiltFrame("[{\"$bytes\":\"0\"}]", [Uint8Array.of(1)])],
    ["a fractional placeholder", handBuiltFrame("[{\"$bytes\":0.5}]", [Uint8Array.of(1)])],
    ["a placeholder in a text frame", "{\"payload\":{\"$bytes\":0}}"],
    ["a repeated placeholder", handBuiltFrame("[{\"$bytes\":0},{\"$bytes\":0}]", [Uint8Array.of(1)])],
    [
      "an attachment without a placeholder",
      handBuiltFrame("[{\"$bytes\":0}]", [Uint8Array.of(1), Uint8Array.of(2)])
    ]
  ];
  for (const [name, frame] of kMalformed) {
    test(`rejects ${name}`, () => {
      assert.equal(decodeError(frame).reason, "invalid-frame");
    });
  }

  test("reports a binary frame whose header is not JSON as invalid JSON", () => {
    assert.equal(decodeError(handBuiltFrame("{oops")).reason, "invalid-json");
  });
});

describe("encodedLength", () => {
  test("counts bytes by their byte length rather than their JSON form", () => {
    const empty = encodedLength({ mask: Uint8Array.of() });

    assert.equal(encodedLength({ mask: new Uint8Array(1_000) }) - empty, 1_000);
  });

  test("is the JSON length of a value without bytes", () => {
    const value = { name: "Ada", cursor: [1, 2] };

    assert.equal(encodedLength(value), JSON.stringify(value).length);
  });
});
