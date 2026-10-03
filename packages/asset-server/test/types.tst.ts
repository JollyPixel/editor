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
  AssetWriteData,
  CatalogApplied,
  CatalogChange,
  CatalogDeleteCommand,
  ImportPlan
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
  readonly dependencies?: {
    readonly id: string;
    readonly kind: string;
  }[];
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

  test("AssetWriteData narrows content and carries optional dependencies", () => {
    expect<AssetWriteData>().type.toBe<LegacyWriteData>();
  });

  test("AssetRenamedData is unchanged", () => {
    expect<AssetRenamedData>().type.toBe<LegacyRenamedData>();
  });

  test("AssetDeletedData is unchanged", () => {
    expect<AssetDeletedData>().type.toBe<LegacyDeletedData>();
  });
});

interface LegacyArchiveEntry {
  readonly id: string;
  readonly kind: string;
  readonly path: string;
}

interface LegacyImportPlan {
  readonly root?: {
    readonly id: string;
    readonly kind: string;
  };
  readonly live: readonly LegacyArchiveEntry[];
  readonly fresh: readonly LegacyArchiveEntry[];
  readonly sharedDependents: readonly (LegacyArchiveEntry & {
    readonly dependents: readonly LegacyArchiveEntry[];
  })[];
  readonly incompatible: readonly LegacyArchiveEntry[];
}

interface LegacyCatalogChange {
  readonly eventType:
    | "asset.created"
    | "asset.updated"
    | "asset.renamed"
    | "asset.deleted";
  readonly assetId: string;
  readonly record: {
    readonly id: string;
    readonly kind: string;
    readonly source: string;
    readonly revision?: string;
  } | null;
  readonly dependencies?: readonly {
    readonly id: string;
    readonly kind: string;
  }[];
}

describe("schema-derived catalog types", () => {
  test("CatalogChange keeps its wire shape", () => {
    expect<CatalogChange>().type.toBeAssignableTo<LegacyCatalogChange>();
    expect<LegacyCatalogChange>().type.toBeAssignableTo<CatalogChange>();
  });

  test("ImportPlan keeps its wire shape", () => {
    expect<ImportPlan>().type.toBeAssignableTo<LegacyImportPlan>();
    expect<LegacyImportPlan>().type.toBeAssignableTo<ImportPlan>();
  });

  test("a command type narrows to its own fields", () => {
    expect<CatalogDeleteCommand>().type.toBeAssignableTo<{
      readonly type: "catalog:delete";
      readonly assetId: string;
      readonly force?: boolean;
    }>();
    expect<keyof CatalogDeleteCommand>()
      .type.toBe<"type" | "assetId" | "force">();
  });

  test("an applied reply pairs each command with its result", () => {
    expect<Extract<CatalogApplied, { assetId: string; }>["command"]>()
      .type.toBe<"catalog:create" | "catalog:rename" | "catalog:delete">();
    expect<Extract<CatalogApplied, { content: unknown; }>["command"]>()
      .type.toBe<"catalog:export">();
  });
});
