// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type {
  DeepReadonly,
  DistributiveOmit
} from "../src/index.ts";

interface Move {
  type: "move";
  requestId: string;
  x: number;
}

interface Rename {
  type: "rename";
  requestId: string;
  name: string;
}

declare const record: DeepReadonly<{
  tags: { name: string; }[];
  bytes: Uint8Array;
  range: [number, number];
  onChange: (value: number) => void;
}>;

test("DistributiveOmit omits the key from each union member", () => {
  expect<DistributiveOmit<Move | Rename, "requestId">>().type.toBe<
    Omit<Move, "requestId"> | Omit<Rename, "requestId">
  >();
});

test("DeepReadonly makes nested arrays and objects readonly", () => {
  expect(record.tags).type.toBe<readonly { readonly name: string; }[]>();
});

test("DeepReadonly leaves Uint8Array writable", () => {
  expect(record.bytes).type.toBe<Uint8Array>();
});

test("DeepReadonly keeps tuple positions", () => {
  expect(record.range).type.toBe<readonly [number, number]>();
});

test("DeepReadonly keeps functions callable", () => {
  expect(record.onChange).type.toBe<(value: number) => void>();
});
