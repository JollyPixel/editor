// Import Third-party Dependencies
import {
  describe,
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type {
  AssetContent,
  AssetDeletedData,
  AssetInlineContent,
  AssetRenamedData,
  AssetWriteData
} from "#src/index.ts";

type LegacyInlineContent = {
  readonly type: "inline";
  readonly encoding: "base64";
  readonly data: string;
};

type LegacyContent =
  | LegacyInlineContent
  | {
    readonly type: "ref";
    readonly hash: string;
    readonly size: number;
  };

interface LegacyWriteData {
  readonly path: string;
  readonly kind: string;
  readonly hash: string;
  readonly size: number;
  readonly content: LegacyInlineContent;
}

interface LegacyRenamedData {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
  readonly hash: string;
}

interface LegacyDeletedData {
  readonly path: string;
  readonly kind: string;
}

describe("schema-derived payload types", () => {
  test("AssetContent still describes both wire encodings", () => {
    expect<AssetContent>().type.toBe<LegacyContent>();
  });

  test("AssetInlineContent is the inline branch alone", () => {
    expect<AssetInlineContent>().type.toBe<LegacyInlineContent>();
  });

  test("AssetWriteData keeps its fields and narrows content", () => {
    expect<AssetWriteData>().type.toBe<LegacyWriteData>();
  });

  test("AssetRenamedData is unchanged", () => {
    expect<AssetRenamedData>().type.toBe<LegacyRenamedData>();
  });

  test("AssetDeletedData is unchanged", () => {
    expect<AssetDeletedData>().type.toBe<LegacyDeletedData>();
  });
});
