// Import Third-party Dependencies
import type * as z from "zod/mini";

// Import Internal Dependencies
import type { AssetOpening } from "../asset/AssetOpening.ts";
import type { GolemAsset } from "../asset/GolemAsset.ts";
import type { GolemIntent } from "./golemIntent.ts";

// CONSTANTS
export const GOLEM_KINDS_EXPORT = "GOLEM_KINDS";

export interface GolemAssets {}

export type GolemKindName = keyof GolemAssets;

export type GolemIntents<TAsset> = Readonly<Record<string, GolemIntent<TAsset>>>;

export interface GolemKindOptions<TAsset> {
  /**
   * Edits an agent asks for by name through the MCP server's `asset_intent`.
   * @default {}
   */
  intents?: GolemIntents<TAsset>;
  /**
   * A Markdown file an agent reads when it opens an asset of the kind.
   */
  guide?: URL;
}

export interface GolemKindContribution<TAsset> {
  readonly kind: string;
  readonly schema: z.ZodMiniType;
  readonly intents: GolemIntents<TAsset>;
  readonly guide: URL | null;
  open(opening: AssetOpening): TAsset;
}

export type GolemKindList = readonly GolemKindContribution<GolemAsset>[];

export function golemKind<
  TDocumentKind extends {
    readonly kind: string;
    readonly commandSchema: z.ZodMiniType;
  },
  TAsset
>(
  documentKind: TDocumentKind,
  Asset: new (opening: AssetOpening, kind: TDocumentKind) => TAsset,
  options: GolemKindOptions<NoInfer<TAsset>> = {}
): GolemKindContribution<TAsset> {
  const {
    intents = {},
    guide = null
  } = options;

  return {
    kind: documentKind.kind,
    schema: documentKind.commandSchema,
    intents,
    guide,
    open: (opening) => new Asset(opening, documentKind)
  };
}
