// Import Third-party Dependencies
import {
  describe,
  expect,
  test
} from "tstyche";
import * as z from "zod/mini";

// Import Internal Dependencies
import type {
  AssetCommandHeader,
  AssetCommands,
  AssetKindHandler,
  AssetContent,
  AssetDeletedData,
  AssetInlineContent,
  AssetRelaySchemas,
  AssetRenamedData,
  AssetWriteData,
  CatalogApplied,
  CatalogChange,
  CatalogDeleteCommand,
  ImportPlan
} from "#src/index.ts";
import {
  LiveAssetRoom,
  type AssetServerMessage
} from "#src/testing/index.ts";

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
  readonly restoredFrom?: {
    readonly name: string;
    readonly eventVersion: number;
  };
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

  test("AssetWriteData narrows content and carries optional dependencies and restoredFrom", () => {
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
    readonly path: string;
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
      readonly assetIds: readonly string[];
      readonly force?: boolean;
    }>();
    expect<keyof CatalogDeleteCommand>()
      .type.toBe<"type" | "assetIds" | "force">();
  });

  test("an applied reply pairs each command with its result", () => {
    expect<Extract<CatalogApplied, { assetId: string; }>["command"]>()
      .type.toBe<"catalog:create" | "catalog:tags" | "catalog:untag">();
    expect<Extract<CatalogApplied, { tag: unknown; }>["command"]>()
      .type.toBe<"catalog:tag">();
    expect<Extract<CatalogApplied, { report: unknown; }>["command"]>()
      .type.toBe<"catalog:import" | "catalog:restore">();
    expect<Extract<CatalogApplied, { applied: number; }>["command"]>()
      .type.toBe<"catalog:rename" | "catalog:delete">();
    expect<Extract<CatalogApplied, { content: unknown; }>["command"]>()
      .type.toBe<"catalog:export">();
  });
});

describe("relay message types", () => {
  const nudge = z.object({
    action: z.literal("nudge"),
    to: z.string()
  });
  const poke = z.object({
    action: z.literal("poke")
  });

  test("a relay accepts schemas that parse its message", () => {
    expect({ inbound: [nudge], outbound: [] })
      .type.toBeAssignableTo<AssetRelaySchemas<z.infer<typeof nudge>>>();
  });

  test("a relay refuses schemas that parse another message", () => {
    expect({ inbound: [nudge, poke], outbound: [] })
      .type.not.toBeAssignableTo<AssetRelaySchemas<z.infer<typeof nudge>>>();
  });
});

interface RoomCommand extends AssetCommandHeader {
  readonly action: "increment";
}

const kNudge = z.object({
  action: z.literal("nudge")
});

declare const kPlainKind: AssetKindHandler<unknown, RoomCommand>;
declare const kRelayKind: AssetKindHandler<
  unknown,
  RoomCommand,
  z.infer<typeof kNudge>
>;
declare const kProtocol: AssetCommands["protocol"];

describe("asset room message types", () => {
  test("a room without a relay receives exactly its commands", () => {
    const room = new LiveAssetRoom(kPlainKind);

    expect<Parameters<typeof room.extension.onMessage>[1]>()
      .type.toBe<RoomCommand>();
    expect(room.take("B"))
      .type.toBe<AssetServerMessage<RoomCommand, unknown>[]>();
    expect(room.take<{ value: number; }>("B"))
      .type.toBe<AssetServerMessage<RoomCommand, { value: number; }>[]>();
  });

  test("a room with a relay receives its commands and relay messages", () => {
    const room = new LiveAssetRoom(kRelayKind);

    expect<Parameters<typeof room.extension.onMessage>[1]>()
      .type.toBe<RoomCommand | z.infer<typeof kNudge>>();
  });

  test("commands without a relay type refuse relay schemas", () => {
    const commands = {
      eventType: "counter",
      protocol: kProtocol,
      apply: () => void 0
    };

    expect(commands)
      .type.toBeAssignableTo<AssetCommands<unknown, RoomCommand>>();
    expect({
      ...commands,
      relay: { inbound: [kNudge], outbound: [] }
    }).type.not.toBeAssignableTo<AssetCommands<unknown, RoomCommand>>();
  });
});
